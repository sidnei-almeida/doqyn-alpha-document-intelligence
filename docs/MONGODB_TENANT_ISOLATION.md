# Isolamento por tenant — MongoDB DOQYN

Este documento define o modelo canônico de coleções e as regras de isolamento multi-tenant do DOQYN.

## 1. Coleções globais (registry)

Estas coleções **não** são prefixadas por tenant. Contêm metadados de clientes, vínculos e legado temporário:

| Coleção | Propósito |
|---------|-----------|
| `tenants` | Registry de clientes (business e individual) |
| `tenant_members` | Vínculo **Auth userId** ↔ tenant, roles e grupos (campo legado `keycloakUserId` = userId do Auth) |
| `companies` | **Legado** — espelho durante migração |
| `company_members` | **Legado** — dual-write/read com `tenant_members` |

**Regra:** endpoints globais (`doqyn_admin`) podem consultar registry. Operações tenant-scoped **nunca** devem usar estas coleções para documentos, regras ou grupos.

## 2. Coleções tenant-scoped

Dados de negócio ficam isolados por tenant. Para tenant **business** com `isolation.strategy = collection_prefix`:

```
access_groups_<collectionPrefix>
document_classes_<collectionPrefix>
document_rules_<collectionPrefix>
documents_<collectionPrefix>
document_versions_<collectionPrefix>
processing_jobs_<collectionPrefix>
audit_logs_<collectionPrefix>
```

Exemplo dev: `documents_company_dev`, `document_rules_company_dev`.

### Campos obrigatórios em documentos tenant-scoped

Mesmo com coleção prefixada, cada documento deve conter:

- `tenantId` — identificador oficial do tenant
- `companyId` — alias legado (= `tenantId`) durante migração

Queries devem usar `tenantScopeFilter(tenantId)` para compatibilidade com registros legados.

## 3. Business tenant — `collection_prefix`

```typescript
tenant.tenantType === 'business'
tenant.isolation.strategy === 'collection_prefix'
tenant.isolation.collectionPrefix // ex: company_dev, tenant_xxxxx
```

- Cada tenant business tem **coleções físicas separadas** no mesmo database.
- O prefixo vem **somente** de `tenant.isolation.collectionPrefix`.
- Resolução centralizada em `getTenantCollections(tenantId)` / `getTenantDbCollections(db, tenant)`.

## 4. Individual tenant — `shared_individual_pool` (futuro)

```typescript
tenant.tenantType === 'individual'
tenant.isolation.strategy === 'shared_individual_pool'
tenant.isolation.collectionPrefix // default: individual_pool
```

- Coleções compartilhadas: `documents_individual_pool`, etc.
- **Toda query** deve filtrar por `tenantId` **e** `ownerUserId`.
- Fluxos individuais ainda não estão totalmente implementados; a arquitetura está preparada.

## 5. Proibições de segurança

### 5.1 CPF/CNPJ em nome de coleção

**Proibido** usar CPF ou CNPJ cru como `collectionPrefix`.

- Validação em `resolveTenantCollectionPrefix()` e `isUnsafeCollectionPrefix()`.
- Use identificadores internos: `company_dev`, `tenant_a1b2c3`, `individual_pool`.

### 5.2 Consulta tenant-scoped sem contexto

**Proibido** em código produtivo:

```typescript
// ❌ NUNCA
db.collection('documents').find({})
db.collection('document_rules').find({ classId })
```

**Obrigatório:**

```typescript
const collections = await getTenantCollections(tenantId);
await collections.documents.find({ ...tenantScopeFilter(tenantId) });
```

Guard de runtime: `assertTenantScopedCollectionAccess(tenant, collectionName)`.

### 5.3 Coleções flat legadas

Coleções sem prefixo (`documents`, `access_groups`, …) são **legado**.

- Scripts de migração e auditoria podem lê-las.
- **Nenhum endpoint produtivo** deve ler ou escrever nelas após a migração.
- Remoção só com `MIGRATION_DELETE_LEGACY=true` e backup prévio.

## 6. API de acesso às coleções

| Função | Uso |
|--------|-----|
| `getTenantCollections(tenantId)` | Resolve tenant ativo + handles de coleção |
| `getTenantDbCollections(db, tenant)` | Quando o tenant já está carregado |
| `requireBusinessAdminCollections(tenantId)` | Exige grupos, classes e regras (business) |
| `tenantScopeFilter(tenantId)` | Filtro `$or` tenantId/companyId |
| `withTenantFields(tenantId, doc)` | Injeta tenantId + companyId em writes |
| `assertNotFlatTenantCollection(name)` | Bloqueia coleção flat em runtime |

## 7. Autorização

- **Autenticação:** doqyn-auth-service (cookie HttpOnly + `/internal/sessions/verify`). **Sem Keycloak.**
- **Autorização contextual:** sessão Auth (roles + accessGroupIds) + regras documentais no Mongo (`document_rules_*`, categorias/grupos). Access groups de produto vêm do **Auth** (API Mongo `access_groups` responde 410).
- Contexto de tenant: `/api/me` → `requireAuth` → `activeMembership.tenantId`.
- `company_admin` só acessa dados do próprio `tenantId`.
- `doqyn_admin` pode acessar endpoints globais explicitamente.

## 8. Scripts operacionais

| Comando | Propósito |
|---------|-----------|
| `npm run audit:mongodb-schema` | Auditoria de schema e índices |
| `npm run audit:collection-usage` | Uso de coleções flat no código |
| `npm run db:ensure-indexes` | Índices canônicos idempotentes |
| `npm run db:seed-isolation-test` | Segundo tenant de teste |
| `npm run test:tenant-isolation` | Testes de isolamento entre tenants |
| `npm run audit:no-flat-writes` | Verifica ausência de writes flat produtivos |

## 9. Migração e legado

Estado atual em `doqyn_dev`:

- Coleções prefixadas `*_company_dev` são a **fonte canônica**.
- Coleções flat coexistem com dados de desenvolvimento duplicados.
- A migração achatado → prefixado foi revertida como modelo: desde o Passo 7 as coleções
  são achatadas e compartilhadas, escopadas por campo `tenantId`. O script de migração foi
  retirado por migrar na direção contrária à vigente.
- `company_members` será desligado quando `tenant_members` for fonte única.

## 10. Referências no código

- `server/tenancy/getTenantCollections.ts`
- `server/tenancy/tenantResolver.ts`
- `server/tenancy/collectionGuard.ts`
- `server/tenancy/tenantQuery.ts`
- `server/db/constants.ts`
