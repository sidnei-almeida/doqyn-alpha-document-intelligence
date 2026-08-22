# DOQYN — Desenvolvimento local

Guia mínimo para subir o ambiente completo em uma máquina de desenvolvimento.

## Arquitetura

| Serviço | Repositório | Porta | Banco |
|---------|-------------|-------|-------|
| auth-service | `doqyn-auth-service` | **4100** | Postgres (5433) |
| document-api | `doqyn-alpha-document-intelligence` (`server/dev-server.ts`) | **3001** | MongoDB (27017) |
| web (Vite) | `doqyn-alpha-document-intelligence` | **5173** | — |

O frontend fala apenas com o Vite dev server, que faz proxy:

- `/api` → `http://localhost:3001` (document-api)
- `/auth` e `/oauth` → `http://localhost:4100` (auth-service)

O auth-service permanece um serviço separado — não é fundido no app principal.

## 1. Infra (bancos) via Docker

```bash
cd doqyn-alpha-document-intelligence
docker compose -f deploy/docker-compose.dev.yml up -d
docker compose -f deploy/docker-compose.dev.yml ps
```

Sobe `postgres-auth` (5433) e `mongo` (27017) com healthchecks e volumes
persistentes. As APIs rodam fora do Docker no dev (hot reload).

> Alternativa: o `doqyn-auth-service` tem um `docker-compose.yml` próprio que
> sobe Postgres + migrations + a API em container.

## 2. Variáveis de ambiente

Exemplos em `deploy/env/`:

- `auth-service.env.example` → copiar para o `.env` do **doqyn-auth-service**
- `app-api.env.example` → copiar para o `.env` do **doqyn-alpha**
- `app-web.env.example` → variáveis `VITE_*` do frontend

Nunca commitar `.env` com segredos. Os secrets OAuth vivem apenas no
auth-service; o frontend não recebe client secret algum.

### OAuth Google (dev)

```
OAUTH_GOOGLE_REDIRECT_URI=http://127.0.0.1:4100/oauth/google/callback
OAUTH_POST_LOGIN_REDIRECT_URL=http://localhost:5173/sso/callback
OAUTH_ERROR_REDIRECT_URL=http://localhost:5173/login
OAUTH_MICROSOFT_ENABLED=false
```

Detalhes completos em `docs/OAUTH_SETUP.md`.

## 3. Subir as APIs e o frontend

```bash
# Terminal 1 — auth-service
cd doqyn-auth-service
npx prisma migrate dev   # primeira vez / após novas migrations
npm run dev              # porta 4100

# Terminal 2 — alpha (document-api + Vite)
cd doqyn-alpha-document-intelligence
npm run dev              # Vite 5173 + dev-server 3001
```

Acesse `http://localhost:5173`. Após o login, a home é a **Biblioteca**
(`/biblioteca`).

## 4. Validação

```bash
# alpha
npm test && npm run build && npm run lint && npx tsc --noEmit

# auth-service
npm test && npm run build && npm run lint && npx tsc --noEmit
```

## Notas

- **R2**: em dev use `STORAGE_PROVIDER=local` para não depender de credenciais
  Cloudflare. Em produção/staging, `r2` com credenciais via env.
- **Rota legada** `/upload` continua acessível como fallback, mas fora da
  navegação. O upload oficial é pela Biblioteca (+ Novo ou drag and drop).
- Staging/VPS completo (imagens das APIs + nginx) fica para uma fase futura;
  este compose cobre apenas a infra de desenvolvimento.
