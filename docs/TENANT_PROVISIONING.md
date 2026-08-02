# Provisionamento de tenant

## Fluxo

1. **Auth-service** cria tenant + membership no Postgres.
2. Auth-service chama `POST /api/internal/tenants/provision` no app principal.
3. App principal executa `provisionTenantEnvironment` (`server/services/tenantProvisionService.ts`).

## Business (CNPJ)

- `tenantType: business`
- `collectionPrefix` = `tenantId`
- Cria collections dedicadas: `documents_{tenantId}`, `document_versions_{tenantId}`, etc.
- Índices por `tenantId` / `companyId`

## Individual (CPF)

- `tenantType: individual`
- `collectionPrefix: compartilhado`
- **Não** cria `documents_individual_*`
- Reutiliza `documents_compartilhado` e demais `*_compartilhado`
- Garante índices compostos `ownerTenantId + ownerUserId`

Dois CPFs diferentes compartilham as mesmas collections físicas; o isolamento é por ownership nos queries.

## Endpoint interno

`POST /api/internal/tenants/provision` — requer API key interna (`APP_INTERNAL_API_KEY`).

Payload esperado (individual):

```json
{
  "tenantId": "individual_nome_ab12cd",
  "tenantType": "individual",
  "displayName": "Maria Silva",
  "collectionPrefix": "compartilhado",
  "createdByUserId": "...",
  "createdByMembershipId": "..."
}
```

## Validação local

1. Subir auth-service + Postgres + app principal.
2. Criar CPF em `/criar-acesso-cpf`.
3. Confirmar `/api/me` com `tenantType: individual`.
4. No Mongo, verificar que existe `documents_compartilhado` e **não** `documents_individual_*`.
5. Criar segundo CPF e confirmar reutilização da mesma collection.

Testes automatizados: `tests/tenant-provision.test.ts`, `tests/individual-isolation.test.ts`.
