# Configuração OAuth (Google e Microsoft)

Este guia descreve como habilitar login social no DOQYN usando o `doqyn-auth-service` com Authorization Code + PKCE.

## Visão geral

- O **frontend** redireciona para `/oauth/google/start` ou `/oauth/microsoft/start` (proxied para o auth-service em desenvolvimento).
- O **auth-service** valida `state`, `nonce` e PKCE, troca o `code` por tokens, valida o `id_token` e cria a **sessão DOQYN** (`doqyn_session` HttpOnly).
- O **app principal** nunca recebe tokens do Google/Microsoft — apenas a sessão DOQYN via cookie.

## Variáveis de ambiente (auth-service)

```env
OAUTH_GOOGLE_ENABLED=true
OAUTH_GOOGLE_CLIENT_ID=
OAUTH_GOOGLE_CLIENT_SECRET=
OAUTH_GOOGLE_REDIRECT_URI=http://127.0.0.1:4100/oauth/google/callback

OAUTH_MICROSOFT_ENABLED=true
OAUTH_MICROSOFT_CLIENT_ID=
OAUTH_MICROSOFT_CLIENT_SECRET=
OAUTH_MICROSOFT_TENANT=common
OAUTH_MICROSOFT_REDIRECT_URI=http://127.0.0.1:4100/oauth/microsoft/callback

OAUTH_POST_LOGIN_REDIRECT_URL=http://localhost:5173/auth/oauth/callback
OAUTH_ERROR_REDIRECT_URL=http://localhost:5173/login
```

Em produção, use **HTTPS** em todos os redirect URIs.

## Google Cloud

1. Acesse [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials.
2. Crie um **OAuth client ID** do tipo **Web application**.
3. Authorized redirect URIs:
   - Dev: `http://127.0.0.1:4100/oauth/google/callback`
   - Prod: `https://auth.<seu-dominio>/oauth/google/callback`
4. Copie **Client ID** e **Client secret** para o `.env` do auth-service.

## Microsoft Entra ID

1. Acesse [Microsoft Entra admin center](https://entra.microsoft.com/) → App registrations → New registration.
2. Redirect URI (Web):
   - Dev: `http://127.0.0.1:4100/oauth/microsoft/callback`
   - Prod: `https://auth.<seu-dominio>/oauth/microsoft/callback`
3. Em **Certificates & secrets**, crie um client secret.
4. Supported account types:
   - **Accounts in any organizational directory and personal Microsoft accounts** → `OAUTH_MICROSOFT_TENANT=common`
   - **Accounts in any organizational directory only** → `OAUTH_MICROSOFT_TENANT=organizations`
5. Copie Application (client) ID e secret para o `.env`.

## Desenvolvimento local

1. Suba o PostgreSQL do auth-service: `npm run dev:db`
2. Rode migrations: `npx prisma migrate dev`
3. Configure `.env` com client IDs/secrets
4. Suba auth-service: `npm run dev` (porta 4100)
5. Suba o app principal: `npm run dev` (porta 5173)
6. O Vite proxy encaminha `/auth` e `/oauth` para `:4100`

## Fluxo do usuário

1. Login → **Continuar com Google/Microsoft**
2. Provedor autentica
3. Auth-service cria sessão DOQYN
4. Redirect para `/auth/oauth/callback`
5. Frontend valida sessão:
   - tenant ativo → app (`/upload`)
   - sem membership → `/onboarding` (CPF / CNPJ / pedir acesso)
   - pending/blocked/rejected → tela de status correspondente

## Segurança

- Nunca logar `client_secret`, `id_token`, `authorization code` ou tokens de provider.
- `returnUrl` aceita apenas paths internos (`/upload`, `/dashboard`, etc.).
- OAuth usa `state`, `nonce` e PKCE (S256).

## Logout

Logout DOQYN encerra apenas a sessão local. Não desloga a conta Google/Microsoft.
