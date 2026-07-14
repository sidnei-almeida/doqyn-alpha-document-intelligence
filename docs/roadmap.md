# Roadmap — DOQYN Alpha

## Feito

- [x] Login / sessão via **doqyn-auth-service** (cookie HttpOnly)
- [x] Multi-tenant (Postgres Auth + Mongo prefixado)
- [x] Upload + análise PDF (Groq) + confirm / versionamento
- [x] OCR opcional (Google Cloud Vision)
- [x] Storage R2 / local + preview Ghostscript
- [x] Filas BullMQ (análise + preview)
- [x] Assinaturas eletrônicas + portal guest
- [x] Governança (categorias, grupos, regras de acesso/extração)
- [x] Lixeira, shares, favoritos, auditoria/tracking
- [x] OAuth Google/Microsoft no auth-service (quando configurado)
- [x] Remoção completa do **Keycloak** do fluxo de autenticação

## Em andamento / próximo

- [ ] Notificações reais (e-mail + WhatsApp) — preferências já existem; worker ainda não
- [ ] SMTP de produto estável (reset/convites em produção)
- [ ] RAG conversacional sobre `document_chunks`
- [ ] Renomear campo legado `keycloakUserId` → `authUserId` (migração Mongo)
- [ ] Remover/aisolar temporary-auth e collections legadas (`companies`, `document_classes`)
- [ ] Alinhar scripts de audit Mongo com SHARED_APP + categories

## Fora de escopo / descartado

- ~~Integração Keycloak (OIDC/SSO)~~ — **dropado**; identidade = doqyn-auth-service
- ~~Mongoose~~ — driver nativo `mongodb`
