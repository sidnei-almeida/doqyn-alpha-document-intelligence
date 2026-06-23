# DOQYN — Alpha Document Intelligence

Versão alpha técnica da plataforma **DOQYN** para gestão segura, inteligente e rastreável de documentos empresariais.

## Objetivo desta fase

Validar o fluxo principal da plataforma:

1. Acesso e login
2. Envio de documento
3. Registro de metadados
4. Processamento simulado (preparado para IA/OCR)
5. Status, histórico, rastreabilidade e versionamento

## Stack

| Camada | Tecnologias |
|--------|-------------|
| Frontend | React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, React Hook Form, Zod, Zustand, Sonner |
| Backend | Node.js, TypeScript, API serverless (`/api`), Mongoose, Zod |
| Banco | MongoDB Atlas (metadados apenas) |
| Auth | Autenticação temporária (JWT + cookie httpOnly), preparada para Keycloak/OIDC |

## Início rápido

```bash
# Instalar dependências
npm install

# Copiar variáveis de ambiente
cp .env.example .env

# Gerar hash da senha temporária
node scripts/generate-password-hash.mjs "sua-senha-aqui"
# Copie o hash para TEMP_ADMIN_PASSWORD_HASH no .env

# Defina JWT_SECRET (mínimo 32 caracteres) no .env

# Terminal 1 — API local (porta 3001)
npm run dev:api

# Terminal 2 — Frontend (porta 5173)
npm run dev
```

Acesse [http://localhost:5173](http://localhost:5173) e faça login com o e-mail e senha configurados em `.env` (`TEMP_ADMIN_EMAIL` + senha usada no hash).

## Temporary Auth

Esta versão alpha usa autenticação temporária enquanto o Keycloak não está disponível.

Variáveis obrigatórias (backend — **sem** prefixo `VITE_`):

- `TEMP_ADMIN_EMAIL`
- `TEMP_ADMIN_PASSWORD_HASH`
- `TEMP_ADMIN_NAME`
- `TEMP_COMPANY_ID`
- `TEMP_COMPANY_NAME`
- `TEMP_USER_ROLE`
- `TEMP_USER_AREA`
- `TEMP_USER_GROUPS`
- `JWT_SECRET`
- `AUTH_COOKIE_NAME`
- `AUTH_COOKIE_SECURE`
- `AUTH_SESSION_MAX_AGE_SECONDS`

Gerar hash da senha:

```bash
node scripts/generate-password-hash.mjs "your-password"
```

Em desenvolvimento local, use `AUTH_COOKIE_SECURE=false`. Na Vercel, configure `AUTH_COOKIE_SECURE=true` e todas as variáveis no painel do projeto.

A sessão usa cookie **httpOnly** — o JWT não fica no frontend nem no `localStorage`.

A autenticação será substituída por Keycloak/OIDC no futuro.

## Estrutura do projeto

```
src/                  # Frontend React
  app/                # Rotas, providers, App
  components/         # Design system e layout
  features/           # Módulos por domínio (auth, upload, documents, audit...)
  lib/                # Utilitários, API client, constantes
  types/              # Tipos TypeScript compartilhados

api/                  # Handlers serverless (Vercel)
server/               # Lógica de negócio, modelos, serviços, DB
docs/                 # Documentação técnica
```

## Variáveis de ambiente

Consulte `.env.example`. Variáveis com prefixo `VITE_` são públicas no frontend — **nunca** coloque segredos nelas.

## Telas disponíveis

- **Login** — autenticação temporária + botão SSO/Keycloak (desabilitado)
- **Visão Geral** — dashboard com métricas
- **Enviar documento** — upload com drag & drop
- **Documentos** — listagem, filtros e detalhes
- **Versionamento** — histórico e nova versão
- **Auditoria** — rastreabilidade de eventos
- **Configurações** — preferências básicas

## API

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/health` | GET | Status do sistema |
| `/api/auth/login` | POST | Login temporário (cookie httpOnly) |
| `/api/auth/me` | GET | Usuário da sessão atual |
| `/api/auth/logout` | POST | Encerrar sessão |
| `/api/documents` | GET | Listar documentos |
| `/api/documents/upload` | POST | Enviar documento |
| `/api/audit` | GET | Listar eventos de auditoria |

## Documentação

- [Arquitetura](docs/architecture.md)
- [Roadmap](docs/roadmap.md)
- [Notas de segurança](docs/security-notes.md)

## Próximas etapas

- Integração real com Keycloak
- Google Document AI / Cloud Vision
- Storage em AWS S3 e Cloudflare R2
- Regras de acesso avançadas
- RAG com Groq
