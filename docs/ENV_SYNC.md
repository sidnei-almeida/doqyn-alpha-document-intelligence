# Sincronização de env — Auth ↔ Alpha (P0)

Pré-requisito para qualquer deploy local ou VPS.

## Pares obrigatórios

| Alpha (`doqyn-alpha-document-intelligence`) | Auth (`doqyn-auth-service`) | Regra |
|---|---|---|
| `DOQYN_AUTH_INTERNAL_API_KEY` | `DOQYN_INTERNAL_API_KEY` | **Idênticos** (Bearer Alpha→Auth) |
| `DOQYN_APP_INTERNAL_API_KEY` | `DOQYN_APP_INTERNAL_API_KEY` | **Idênticos** (Bearer Auth→Alpha) |
| `DOQYN_AUTH_COOKIE_NAME` | `SESSION_COOKIE_NAME` | **Idênticos** (default `doqyn_session`) |
| `AUTH_PROVIDER` | — | `doqyn_auth` |
| `VITE_AUTH_PROVIDER` | — | `doqyn_auth` |
| `DOQYN_PUBLIC_APP_URL` | `ALLOWED_ORIGINS` | Origem do FE **deve estar** na lista CORS do Auth |
| `DOQYN_PUBLIC_APP_URL` | `DOQYN_APP_PUBLIC_URL` | **Recomendado** iguais |
| `DOQYN_AUTH_BASE_URL` | `PORT` (+ host) | Alpha aponta para o Auth (ex. `http://127.0.0.1:4100`) |
| API `:3001` | `DOQYN_APP_BASE_URL` | Auth aponta para a API Alpha |

> `ALLOWED_ORIGINS` existe **só no Auth**. No Alpha use `DOQYN_PUBLIC_APP_URL` (e a origem real do Vite/nginx).

## Validação automática

No repo **Alpha**:

```bash
# Defaults: ./.env e ../doqyn-auth-service/.env
npm run env:auth-sync

# Paths explícitos
npm run env:auth-sync -- --auth-dir /caminho/do/doqyn-auth-service
npm run env:auth-sync -- --strict-production   # falha se chave for placeholder fraco
```

Exit code `0` = ok (pode haver WARN). Exit `1` = drift ou variável crítica ausente.

O script **nunca imprime** valores secretos.

## Checklist manual (deploy)

1. [ ] Rodar `npm run env:auth-sync -- --strict-production` no ambiente alvo  
2. [ ] `COOKIE_SECURE=true` no Auth em HTTPS  
3. [ ] `ALLOWED_ORIGINS` = domínio público (sem `localhost`) em produção  
4. [ ] Frontend e API atrás do mesmo site (proxy `/auth`) ou cookie Domain coerente  

## Onde documentar no `.env`

Cada `.env.example` tem um bloco `# === SYNC Auth↔Alpha (P0) ===` com os pares.

## Se houver drift

1. Escolha a fonte da verdade (em geral o Auth gera as keys no `setup-production-env.sh`).  
2. Copie o valor para o lado Alpha (ou vice-versa).  
3. Reinicie **os dois** serviços.  
4. Rode `npm run env:auth-sync` de novo.  
5. Smoke: login → `GET /api/me` com cookie.
