# DOQYN — Alpha Document Intelligence

Versão alpha da plataforma **DOQYN** para gestão segura, inteligente e rastreável de documentos empresariais.

## Objetivo desta fase

Validar o fluxo principal da plataforma:

1. Acesso e login (via **doqyn-auth-service**)
2. Envio e análise de documento (IA / OCR)
3. Registro de metadados e versionamento
4. Assinaturas, compartilhamento, auditoria e governança

## Stack

| Camada | Tecnologias |
|--------|-------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, React Hook Form, Zod, Zustand, Sonner |
| Backend | Node.js, TypeScript, handlers em `/api` (dev-server / produção), Zod |
| Banco documental | MongoDB (driver nativo — **não** usa Mongoose) |
| Auth | **doqyn-auth-service** (`AUTH_PROVIDER=doqyn_auth`) — cookie HttpOnly + `/api/me` |
| Storage | Cloudflare R2 (S3 API) ou disco local |
| IA / OCR | Groq (classificação/extração); Google Cloud Vision (OCR opcional) |
| Filas | Redis + BullMQ (análise e preview; fallback síncrono em dev) |

> **Keycloak foi removido por completo** do fluxo de autenticação. O provider oficial é apenas `doqyn_auth`. O campo Mongo legado `keycloakUserId` (quando existir) armazena o **userId do Auth**, não um ID Keycloak.

## Início rápido

Requer o **doqyn-auth-service** rodando (porta `4100`). Ver também [docs/AUTH_INTEGRATION.md](docs/AUTH_INTEGRATION.md) e [docs/LOCAL_DEV.md](docs/LOCAL_DEV.md).

```bash
# No repo do auth-service (irmão deste projeto)
cd ../doqyn-auth-service
cp .env.example .env   # preencher secrets (ver README do auth)
npm install && npm run dev
SEED_FORCE_PASSWORD_RESET=true npm run db:seed

# Neste repo (Alpha)
cd ../doqyn-alpha-document-intelligence
cp .env.example .env
# Obrigatório alinhar:
#   DOQYN_AUTH_INTERNAL_API_KEY  ==  DOQYN_INTERNAL_API_KEY do auth
#   DOQYN_APP_INTERNAL_API_KEY   idêntico nos dois .env
#   AUTH_PROVIDER=doqyn_auth e VITE_AUTH_PROVIDER=doqyn_auth
npm install
npm run dev            # Vite :5173 + API :3001
```

Acesse [http://localhost:5173](http://localhost:5173).

Credencial de seed do auth (padrão): `sidnei@doqyn.dev` / `DevDoqyn@123`  
(ou o valor de `SEED_DEV_PASSWORD` no `.env` do auth-service).

Scripts úteis:

```bash
npm run dev:api              # só API :3001
npm run dev:web              # só Vite :5173
npm run dev:worker           # worker de análise (filas)
npm run dev:worker:preview   # worker de preview Ghostscript
```

## Autenticação (doqyn_auth)

Provider oficial: `doqyn_auth`, via [doqyn-auth-service](../doqyn-auth-service).

Variáveis principais:

- `AUTH_PROVIDER=doqyn_auth`
- `VITE_AUTH_PROVIDER=doqyn_auth`
- `DOQYN_AUTH_BASE_URL=http://127.0.0.1:4100`
- `DOQYN_AUTH_INTERNAL_API_KEY` — **igual** a `DOQYN_INTERNAL_API_KEY` no auth
- `DOQYN_AUTH_COOKIE_NAME=doqyn_session` — **igual** a `SESSION_COOKIE_NAME` no auth
- `DOQYN_APP_INTERNAL_API_KEY` — **igual** nos dois lados (provisionamento Mongo)
- `VITE_AUTH_BASE_PATH=/auth`

Fluxo resumido:

1. Login em `POST /auth/login` (proxy Vite → auth `:4100`)
2. Cookie HttpOnly `doqyn_session` definido pelo auth-service
3. Frontend chama `GET /api/me`
4. Alpha valida sessão com `POST /internal/sessions/verify` no auth

Consulte `.env.example` para a lista completa.  
**Validar sync Auth↔Alpha:** `npm run env:auth-sync` — ver [docs/ENV_SYNC.md](docs/ENV_SYNC.md).

### Temporary Auth (legado)

O modo `AUTH_PROVIDER=temporary` (JWT local) ainda existe no código para cenários sem auth-service, mas **não é o fluxo oficial**. Prefira `doqyn_auth` em desenvolvimento e produção.

## Estrutura do projeto

```
src/                  # Frontend React
  app/                # Rotas, providers, App
  components/         # Design system e layout
  features/           # Módulos por domínio (upload, library, signature, audit…)
  auth/               # Config de auth no cliente
  lib/                # Utilitários, API client, constantes

api/                  # Handlers HTTP (estilo Vercel)
server/               # Lógica de negócio, tenancy, IA, filas, storage, DB
docs/                 # Documentação técnica
deploy/               # Docker, nginx, envs de produção
```

## Variáveis de ambiente

Consulte `.env.example`. Variáveis com prefixo `VITE_` são públicas no frontend — **nunca** coloque segredos nelas.

## Telas disponíveis

- **Login / onboarding SaaS** — via doqyn-auth-service
- **Biblioteca** — documentos, filtros, preview
- **Enviar documento** — upload + análise IA
- **Assinaturas** — pedidos e portal guest
- **Governança** — categorias, grupos, regras
- **Auditoria / tracking**
- **Configurações**

## API (amostra)

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/health` | GET | Status do sistema |
| `/api/me` | GET | Sessão agregada (via auth-service) |
| `/api/ai/analyze-pdf` | POST | Análise IA do PDF |
| `/api/documents/confirm-analysis` | POST | Persistir documento após análise |
| `/api/documents` | GET | Listar documentos |
| `/api/audit` | GET | Eventos de auditoria |

O login SaaS é `POST /auth/login` no **auth-service** (não no Alpha). `POST /api/auth/login` permanece apenas no fluxo legado `temporary`.

## Documentação

- [Integração Auth](docs/AUTH_INTEGRATION.md)
- [Desenvolvimento local](docs/LOCAL_DEV.md)
- [Documentação completa (PDF)](docs/Documentacao_DoQyn_Alpha_AUH.pdf)
- [Arquitetura](docs/architecture.md)
- [Roadmap](docs/roadmap.md)
- [Notas de segurança](docs/security-notes.md)

## Próximas etapas

- Notificações (e-mail / WhatsApp) com worker real
- RAG conversacional sobre chunks
- Limpeza de campos/nomes legados (`keycloakUserId` → `authUserId` em migração futura)
