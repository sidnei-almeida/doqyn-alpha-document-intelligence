# DoQyn — Estado do produto (bootstrap ClickUp)
**Atualizado:** 14 de julho de 2026  
**Versão:** Alpha técnico `0.1.0`  
**Uso:** Doc canônico para o ClickUp Brain gerar roadmap / backlog. Não inventar features fora deste documento.

---

## 1. O que é o produto

**DoQyn** é uma plataforma de gestão documental empresarial com IA: upload de PDF, classificação/extração, versionamento, assinaturas eletrônicas, compartilhamento, governança (categorias/regras/grupos), auditoria e multi-tenant.

São **dois repositórios**:

| Repo | Papel | Stack resumida | Porta local |
|------|--------|----------------|-------------|
| `doqyn-auth-service` (AUH/Auth) | Identidade, tenants, sessões, roles, grupos, OAuth | Fastify, Prisma, PostgreSQL | `:4100` |
| `doqyn-alpha-document-intelligence` (Alpha) | Documentos, IA, R2, filas, UI | React 19, Vite, MongoDB driver, BullMQ, Groq, R2 | Web `:5173` / API `:3001` |

**Auth oficial:** `AUTH_PROVIDER=doqyn_auth` (cookie HttpOnly).  
**Keycloak:** dropado por completo (campo Mongo legado `keycloakUserId` = userId do Auth; rename futuro).

---

## 2. O que já funciona (não reabrir como “feature nova”)

Marcar como **Done / shipped** no roadmap, não like backlog de build:

- Login / sessão cookie + `/api/me` + verify interno Auth↔Alpha
- Multi-tenant (Postgres Auth + Mongo com collection prefix)
- Provisionamento de tenant no Mongo
- Análise PDF (Groq) + confirm + versionamento
- OCR opcional (Google Vision)
- Storage R2 / local + preview Ghostscript
- Filas BullMQ (análise + preview) com fallback sync em dev
- Assinaturas eletrônicas + portal guest
- Governança: categorias, grupos documentais, regras de acesso e de extração
- Lixeira, shares, favoritos, auditoria/tracking
- OAuth Google/Microsoft no Auth (**código pronto**; falta credenciais no env de quem for usar)
- Admin Auth (members, groups, tenants, invites)

---

## 3. Fronteira de responsabilidade (para etiquetar tasks)

| Auth (Postgres) | Alpha (Mongo + R2) |
|-----------------|--------------------|
| Usuário, senha, sessão, OAuth | Documentos, versões, chunks |
| Tenants, memberships, roles | Metadados, governança documental |
| Access groups (fonte da verdade) | Regras doc, assinaturas, shares |
| Convites / reset / SMTP | IA, filas, storage, preview |

API Mongo `access_groups` no Alpha responde **410** — não criar tasks “implementar access groups no Mongo”.

---

## 4. Dívidas técnicas e gaps (candidatas a Tech Debt / Bugs)

### P0 — impacta uso real / produção
1. **E-mail real (SMTP)** — `EMAIL_ENABLED` off; reset/convites em prod sem entrega confiável  
2. **Alinhar env Auth↔Alpha** — pares de API keys / cookie name / `ALLOWED_ORIGINS` (checklist de sync)  
3. **Bugs de produto em aberto** — (preencher com a lista que o Sidnei reportar no browser; placeholder: “triagem bugs Alpha pós-login”)

### P1 — importante próximo ciclo
4. **Worker de notificações** — preferências email/whatsapp existem; entrega não  
5. **WhatsApp** — só no futuro; preferir e-mail primeiro; canal oficial Meta/BSP depois  
6. **Completar ou remover `AuthEmailVerification`** — model sem fluxo  
7. **Limpar legado temporary-auth / companies / document_classes**  
8. **Rename `keycloakUserId` → `authUserId`** (migração Mongo + código)  
9. **RAG conversacional** sobre chunks (hoje rag-query é parcial)

### P2 — higiene / escala
10. Arquivos vazios na raiz do Auth-repo  
11. Scripts de audit Mongo incompletos vs SHARED_APP + categories  
12. Observabilidade Prometheus/Grafana em prod  
13. Cuidado `REDIS_KEY_PREFIX` se Redis compartilhado entre Auth e Alpha  
14. Placeholder inválido de `DATA_ENCRYPTION_KEY` no `.env.example` do Auth  

---

## 5. Releases sugeridas

| Release | Objetivo | Gate |
|---------|----------|------|
| **Alpha estável (agora)** | Dev local previsível; login; upload/análise; docs alinhados | READMEs OK; env sync; seed ok |
| **Alpha+ (e-mail)** | Reset/convites com SMTP (Resend/Hostinger) | `EMAIL_ENABLED=true` + teste de e-mail |
| **Beta privada** | Multi-user real + notificações e-mail + débitos P1 críticos | Sem temporary-auth em demos |
| **Prod VPS** | Deploy + HTTPS + cookies secure + observabilidade | Checklist security-notes |

---

## 6. Áreas (custom field sugerido)

`Auth` · `Alpha-API` · `Alpha-UI` · `Infra` · `Docs` · `IA` · `Security`

## 7. Repos (custom field)

`doqyn-auth-service` · `doqyn-alpha-document-intelligence` · `ambos`

## 8. Fontes canônicas (não contradizer)

- README de cada repo (atualizados em jul/2026)
- `docs/roadmap.md`, `docs/architecture.md`, `docs/AUTH_INTEGRATION.md`
- PDF interno: `docs/Documentacao_DoQyn_Alpha_AUH.pdf` (v1.2+)
- Credencial seed: `sidnei@doqyn.dev` / `DevDoqyn@123` (ou `SEED_DEV_PASSWORD`)

---

## 9. Fora de escopo (não criar tasks)

- Trazer Keycloak de volta  
- Reimplementar Mongoose  
- Access groups “só no Mongo” como fonte de verdade  
- Chatbot WhatsApp não oficial (Z-API/Evolution) como plano principal  

---

*Fim do Doc de bootstrap. Qualquer task gerada pela IA que contradiga as seções 2 ou 9 deve ser descartada.*
