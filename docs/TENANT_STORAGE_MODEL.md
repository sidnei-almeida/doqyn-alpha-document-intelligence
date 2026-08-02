# Modelo de storage por tenant (CNPJ vs CPF)

## Visão geral

| Tipo | `tenantType` | `storageMode` | `collectionPrefix` | Collections Mongo |
|------|--------------|---------------|--------------------|-------------------|
| Empresa (CNPJ) | `business` | `dedicated_collections` | `tenantId` | `documents_{tenantId}`, etc. |
| Pessoa física (CPF) | `individual` | `shared_individual_collection` | `compartilhado` | `documents_compartilhado`, etc. |

A resolução de collections é feita **somente** via `resolveTenantStorageContext` / `getTenantCollections`. Não monte nomes manualmente (`documents_${tenantId}`).

## Isolamento individual (CPF)

CPFs compartilham as mesmas collections físicas (`*_compartilhado`). O isolamento é **obrigatório** por:

- `tenantType: 'individual'`
- `ownerTenantId` — ID do tenant individual na sessão
- `ownerUserId` — ID do usuário autenticado

Helpers centrais (`server/tenancy/documentOwnership.ts`):

- `buildDocumentOwnershipFilter` — documentos, versões, jobs, audit logs
- `buildClassRuleOwnershipFilter` — classes e regras (`scope: 'global'` **ou** ownership do CPF)

Se `ownerUserId` faltar em contexto individual, a API retorna:

- `OWNER_USER_REQUIRED` (filtros de leitura/gravação)
- `OWNER_CONTEXT_REQUIRED` (contexto de sessão incompleto)

## Access groups

**Fonte de verdade:** auth-service / Postgres (`auth_access_groups`).

O Mongo **não** é fonte de verdade. Collections `access_groups_{tenantId}` são legado; `access_groups_compartilhado` **não existe** e não deve ser criada.

- Runtime: `accessGroupsService` está deprecated (HTTP 410 em `/api/access-groups/*`).
- Frontend com Doqyn Auth: `rulesApi.ts` usa `/auth/admin/access-groups`.
- Validação de grupos em documentos: `groupValidation.ts` consulta auth-service.

## Campos em inserts (individual)

Todo insert em `*_compartilhado` deve gravar via `withTenantFieldsFromContext` / `withClassRuleFieldsFromContext`:

- `tenantType`, `ownerTenantId`, `ownerUserId`
- Classes/regras privadas: `scope: 'tenant'`
- Classes/regras globais (se existirem): `scope: 'global'` (sem ownership)

## Riscos evitados

1. CPF A listar/baixar/editar documentos de CPF B na mesma collection.
2. CPF bruto em `tenantId`, prefixo de collection ou logs.
3. Duplicidade de fonte de verdade para grupos de acesso.
4. Fallback inseguro quando `ownerUserId` está ausente.

## Validação local

```bash
npm test   # tests/tenant-storage.test.ts, tests/individual-isolation.test.ts
```

Cenários cobertos: business dedicado, individual compartilhado, isolamento A/B, `OWNER_USER_REQUIRED`, access groups Mongo deprecated.
