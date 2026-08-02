# Integração doqyn-auth-service

O app principal usa `AUTH_PROVIDER=doqyn_auth` para autenticação via **doqyn-auth-service**.

## Desenvolvimento local

### Terminal 1 — auth-service

```bash
cd ~/Documents/GitHub/doqyn-auth-service
# Nota: neste ambiente o path é Documents/GitHub (sem segundo "G").
docker compose up -d postgres-auth
npm run dev
```

Seed (se necessário):

```bash
docker compose run --rm -e NODE_ENV=development auth-api node dist/db/seed.js
```

Credencial dev (seed atual): `sidnei@doqyn.dev` / `DevDoqyn@123`  
(ou o valor de `SEED_DEV_PASSWORD` no `.env` do auth-service)

### Terminal 2 — app principal

```bash
cd ~/Documents/GitHub/doqyn-alpha-document-intelligence
cp .env.example .env
# Ajuste DOQYN_AUTH_INTERNAL_API_KEY para o mesmo valor de DOQYN_INTERNAL_API_KEY no auth-service
npm run dev
```

Acesse: http://localhost:5173

## Variáveis

| Variável | Onde | Descrição |
|----------|------|-----------|
| `AUTH_PROVIDER=doqyn_auth` | backend | Ativa verify via auth-service |
| `DOQYN_AUTH_BASE_URL` | backend | URL do auth-service (ex.: http://127.0.0.1:4100) |
| `DOQYN_AUTH_INTERNAL_API_KEY` | backend | Chave para `/internal/sessions/verify` |
| `DOQYN_AUTH_COOKIE_NAME` | backend | Nome do cookie (padrão: `doqyn_session`) |
| `VITE_AUTH_PROVIDER=doqyn_auth` | frontend | Modo de auth no browser |
| `VITE_AUTH_BASE_PATH=/auth` | frontend | Prefixo das rotas públicas do auth-service |
| `DOQYN_APP_INTERNAL_API_KEY` | backend | Chave para `POST /api/internal/tenants/provision` |

### Sync P0 (obrigatório)

Antes de deploy ou quando login/`/api/me` falhar:

```bash
npm run env:auth-sync
# ou com paths explícitos / modo produção:
npm run env:auth-sync -- --strict-production
```

Doc: [ENV_SYNC.md](./ENV_SYNC.md) — pares Alpha↔Auth, checklist e o que fazer em caso de drift.

## Onboarding SaaS (login)

| Rota | Fluxo |
|------|-------|
| `/login` | Entrar no sistema |
| `/acesso` | Escolha: pedir acesso ou cadastrar empresa |
| `/solicitar-acesso` | `POST /auth/access-requests` (empresa já ativa) |
| `/criar-empresa` | `POST /auth/company-signups` (novo tenant + provisionamento MongoDB) |

Ver também: [TENANT_PROVISIONING.md](./TENANT_PROVISIONING.md)

## Fluxo

1. Login: `POST /auth/login` (proxy Vite → auth-service)
2. Cookie HttpOnly `doqyn_session` definido pelo auth-service
3. Frontend chama `GET /api/me`
4. Backend lê cookie e chama `POST /internal/sessions/verify`
5. Resposta inclui `user`, `tenant`, `membership`, `roles`, `accessGroupIds` (apenas grupos `active`)

## Proxy Vite (dev)

- `/auth/*` → `http://127.0.0.1:4100/auth/*`
- `/api/*` → `http://localhost:3001/api/*`

## Admin (membros e grupos)

Com `doqyn_auth`, telas administrativas chamam diretamente:

- `/auth/admin/members/*`
- `/auth/admin/access-groups/*`

MongoDB continua responsável apenas por documentos, regras e metadados documentais.

## Keycloak

**Keycloak foi removido por completo** do fluxo de autenticação. Não há provider Keycloak no frontend nem no backend.

O campo Mongo legado `keycloakUserId` (em `tenant_members` e tipos relacionados) **guarda o UUID do usuário no doqyn-auth-service** (`auth_users.id`). O nome do campo é histórico; o valor não vem de Keycloak. Renomeação para `authUserId` fica como migração futura.
