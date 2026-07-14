# Arquitetura — DOQYN Alpha

## Visão geral

Monorepo com frontend SPA (Vite/React) e API Node (handlers em `/api`, servidos por `dev-server` / `production-server`). Identidade fica no serviço irmão **doqyn-auth-service** (PostgreSQL). Documentos e metadados ficam no **MongoDB**; arquivos no **Cloudflare R2** (ou storage local).

```
┌────────────────────────────┐     /auth /oauth      ┌─────────────────────┐
│  Frontend (React :5173)    │ ───────────────────►  │  Auth-service :4100 │
│  Biblioteca, upload, etc.  │ ◄── cookie sessão ─── │  Fastify + Postgres │
└─────────────┬──────────────┘                       └──────────┬──────────┘
              │ /api/*                                         │
              ▼                                                │ verify
┌────────────────────────────┐     Bearer internal◄────────────┘
│  Alpha API :3001           │
│  + workers BullMQ          │
└──────┬─────────┬───────────┘
       │         │
       ▼         ▼
   MongoDB     R2 / Redis / Groq / Vision
```

## Princípios

1. **Metadados no MongoDB, arquivos fora** — Mongo guarda documentos, versões, chunks, auditoria; binários no R2 (ou disco local).
2. **Identidade no Auth-service** — Cookie HttpOnly + `POST /internal/sessions/verify`. **Keycloak não é usado.**
3. **Multi-tenant por collection prefix** — business: `documents_{tenantId}`; PF: pool `*_compartilhado` + filtro `ownerUserId`.
4. **IA no backend** — classificação/extração via Groq; OCR opcional via Google Vision.

## Autenticação

```
AUTH_PROVIDER=doqyn_auth          → backend usa doqynAuthProvider
VITE_AUTH_PROVIDER=doqyn_auth     → frontend usa cookie + /auth/*

# Legado (evitar em novos ambientes):
AUTH_PROVIDER=temporary           → JWT local /api/auth/login
```

`VITE_AUTH_MODE` é legado e só entra se `VITE_AUTH_PROVIDER` não estiver definido. Não há `KeycloakAuthProvider`.

## Processamento de documentos

1. `POST /api/ai/analyze-pdf` (sync ou fila BullMQ)
2. Extração de texto (± Vision OCR) → classificação/extração Groq
3. `POST /api/documents/confirm-analysis` → Mongo + R2 + audit + preview

## Deploy

- **Local:** `npm run dev` (Vite + API)
- **Produção:** Docker / VPS — ver `docs/DEPLOY_VPS.md` e `deploy/`
- **Auth:** stack própria em `doqyn-auth-service`

## Desenvolvimento local

Vite faz proxy de `/api` → `:3001` e `/auth` + `/oauth` → `:4100`.  
Guia: [LOCAL_DEV.md](./LOCAL_DEV.md) e [AUTH_INTEGRATION.md](./AUTH_INTEGRATION.md).
