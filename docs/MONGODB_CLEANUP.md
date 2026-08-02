# Limpeza segura do MongoDB Atlas (DOQYN)

## Decisão de arquitetura

| Dado | Onde fica |
|------|-----------|
| Usuários, tenants, memberships, roles, access groups | **PostgreSQL** (`doqyn-auth-service`) |
| Documentos, versões, classes, regras, jobs, audit documental | **MongoDB** (app principal) |
| Registry de tenants do app | MongoDB collection `tenants` |

MongoDB **não** é fonte de verdade para usuários nem access groups.

## Banco ativo (runtime)

Confirmado em `server/db/database.ts` e `.env`:

| Variável | Valor |
|----------|-------|
| `MONGODB_URI` | URI do cluster Atlas (sem nome de database no path) |
| `MONGODB_DATABASE` | **`doqyn_dev`** (fonte única de verdade) |
| Fallback se ausente | `doqyn_dev` |

O database **não** está embutido na URI — é resolvido por `getMongoDatabaseName()`.

## Banco legado

| Database | Status |
|----------|--------|
| `doqyn_alpha` | **Legado** — não usado pelo app em runtime (`MONGODB_DB_NAME` ignorado pelo código) |
| `admin`, `local`, `config` | **Sistema** — nunca apagar |

## Collections ativas em `doqyn_dev`

### Business (prefixo = tenantId, ex. `company_dev`)

- `documents_company_dev`
- `document_versions_company_dev`
- `document_classes_company_dev`
- `document_rules_company_dev`
- `processing_jobs_company_dev`
- `audit_logs_company_dev`

### Individual (compartilhado)

- `documents_compartilhado`
- `document_versions_compartilhado`
- `document_classes_compartilhado`
- `document_rules_compartilhado`
- `processing_jobs_compartilhado`
- `audit_logs_compartilhado`

### Registry

- `tenants` — usado por `tenantProvisionService`, `tenantsService`, `tenantResolver`

## Collections legadas prováveis

Flat (sem prefixo) — **bloqueadas em runtime** (`collectionGuard.ts`):

- `documents`, `document_versions`, `document_classes`, `document_rules`, `processing_jobs`, `audit_logs`

Access groups Mongo — **deprecated**:

- `access_groups`, `access_groups_company_dev`, `access_groups_*`

Registry legado — **revisão manual antes de apagar**:

- `tenant_members`, `company_members`, `companies`  
  Ainda referenciadas no código para dual-write / auth JWT local. Com `AUTH_PROVIDER=doqyn_auth`, usuários vêm do Postgres; essas collections podem estar obsoletas mas não são removidas automaticamente.

## Fluxo obrigatório (nunca pular)

```
1. npm run mongo:audit          → relatório em docs/mongo-audit-report.json
2. Revisar relatório + este doc
3. npm run mongo:backup         → backups/mongo-cleanup-YYYYMMDD-HHMMSS/
4. npm run mongo:cleanup:dry-run  → lista o que SERIA apagado
5. Confirmar explicitamente
6. DOQYN_MONGO_CLEANUP_CONFIRM="DROP_LEGACY_DOQYN_DATA" npm run mongo:cleanup:execute
```

## Scripts

| Comando | O que faz |
|---------|-----------|
| `npm run mongo:audit` | Inventário read-only de todos os DBs/collections |
| `npm run mongo:backup` | `mongodump` de `doqyn_dev` (+ `doqyn_alpha` se existir) |
| `npm run mongo:cleanup:dry-run` | Simula drops — **não apaga nada** |
| `npm run mongo:cleanup:execute` | Apaga somente com confirmação explícita |

Arquivos:

- `scripts/mongo-audit.mjs`
- `scripts/mongo-cleanup-legacy.mjs`
- `scripts/mongo-backup-before-cleanup.sh`
- `scripts/mongo-cleanup/classification.mjs`

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `MONGODB_URI` | Sim | URI do cluster |
| `MONGODB_DATABASE` | Recomendado | Database ativo (`doqyn_dev`) |
| `DOQYN_MONGO_CLEANUP_CONFIRM` | Execução real | Deve ser `DROP_LEGACY_DOQYN_DATA` |
| `DOQYN_MONGO_CLEANUP_ALLOW_PRODUCTION` | Se URI prod-like | `yes` para permitir em ambiente que pareça produção |

## O que nunca apagar

- Databases: `admin`, `local`, `config`
- Database ativo inteiro: `doqyn_dev`
- `tenants`
- Qualquer `documents_company_*`, `document_*_company_*`, `audit_logs_company_*`, etc.
- Qualquer `*_compartilhado`
- Collections `unknown_review_required` (ex.: `tenant_members`) — só após migração de código

## Restaurar backup

```bash
# Database inteiro
mongorestore --uri "$MONGODB_URI" --db doqyn_dev --drop backups/mongo-cleanup-YYYYMMDD-HHMMSS/doqyn_dev

# Uma collection
mongorestore --uri "$MONGODB_URI" --db doqyn_dev --collection documents backups/.../doqyn_dev/documents.bson
```

## Validação pós-limpeza

1. App principal sobe (`npm run dev`)
2. Login auth-service funciona
3. `/api/me`, `/acesso`, `/criar-empresa`, `/criar-acesso-cpf`
4. Upload/listagem de documentos
5. No Atlas: collections ativas permanecem; legadas removidas
6. Usuários intactos no Postgres

## Referência de código

- Database name: `server/db/database.ts`
- Conexão: `server/db/mongoClient.ts`
- Collections por tenant: `server/tenancy/tenantStorage.ts`, `getTenantCollections.ts`
- Bloqueio flat: `server/tenancy/collectionGuard.ts`
- Access groups deprecated: `server/services/accessGroupsService.ts`
