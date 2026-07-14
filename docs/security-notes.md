# Notas de Segurança — DOQYN Alpha

## Variáveis de ambiente

| Variável | Escopo | Notas |
|----------|--------|-------|
| `VITE_*` | Público (frontend) | Nunca colocar segredos |
| `MONGODB_URI` | Backend | Só servidor |
| `GROQ_API_KEY` | Backend | IA |
| `GOOGLE_APPLICATION_CREDENTIALS` | Backend | Vision OCR |
| `R2_*` / `CLOUDFLARE_*` | Backend | Storage |
| `DOQYN_AUTH_INTERNAL_API_KEY` | Backend | Deve = `DOQYN_INTERNAL_API_KEY` do auth |
| `DOQYN_APP_INTERNAL_API_KEY` | Backend | Compartilhada com auth (provision) |
| `TRACKING_IP_*` | Backend | Hash/cripto de IP em audit |

## Autenticação

- Provider oficial: **`AUTH_PROVIDER=doqyn_auth`** + **`VITE_AUTH_PROVIDER=doqyn_auth`**
- Sessão: cookie **HttpOnly** definido pelo **doqyn-auth-service** (não localStorage)
- Alpha valida com `POST /internal/sessions/verify` (Bearer interno)
- **Keycloak não é usado** — não configure `VITE_AUTH_MODE=keycloak`
- Modo `temporary` (JWT local) é legado e só para cenários sem auth-service

## Upload e storage

- Validação de MIME e tamanho no backend (`MAX_UPLOAD_MB`)
- Binários no R2 (ou storage local) — Mongo só metadados
- Staging temporário em `tmp/{jobId}/` quando presigned estiver ativo

## Auditoria

- Eventos documentais em `audit_logs_{prefix}`
- Auditoria de auth no Postgres (`auth_audit_logs`)
- Preferir logs sem PII em claro

## MongoDB / multi-tenant

- Isolamento por `collectionPrefix` (business) ou pool `compartilhado` (PF)
- Sempre filtrar por `tenantId` / ownership nas queries

## Checklist pré-produção

- [ ] HTTPS e `COOKIE_SECURE=true` no auth
- [ ] Chaves internas fortes e idênticas entre Alpha e Auth
- [ ] Rate limiting (Redis) habilitado onde houver réplicas
- [ ] CORS/`ALLOWED_ORIGINS` restritos
- [ ] SMTP / e-mail de reset habilitados
- [ ] Rotação documentada de `DATA_ENCRYPTION_KEY` (auth) — não rotacionar sem migração
- [ ] Logs sem segredos
