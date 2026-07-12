# Deploy em VPS (Docker Compose)

Stack de produção do DOQYN: auth (PostgreSQL), API principal (MongoDB), **Redis**, **worker de análise**, Nginx (SPA + proxy).

## Pré-requisitos

- Docker e Docker Compose
- Repositórios lado a lado:
  - `doqyn-auth-service`
  - `doqyn-alpha-document-intelligence`

## Serviços

| Serviço | Função |
|---------|--------|
| `postgres-auth` | Banco do auth-service |
| `auth-api` | API de autenticação |
| `mongo` | Dados da aplicação |
| `redis` | Cache de sessão, quotas e fila BullMQ |
| `doqyn-api` | API principal (Vercel handlers via dev-server) |
| `doqyn-worker` | Processa jobs da fila `document-analysis` |
| `nginx` | SPA estática + proxy `/api` e `/auth` |

> Não há container `doqyn-web` separado: o frontend é servido pelo `nginx` a partir do build embutido na imagem.

## Deploy rápido

```bash
cd doqyn-alpha-document-intelligence
./deploy/scripts/setup-production-env.sh   # primeira vez
./deploy/scripts/deploy-production.sh
```

## Variáveis importantes (Fase A)

Definidas em `deploy/.env` (ver `deploy/env/.env.production.example` ou `setup-production-env.sh`):

| Variável | Descrição |
|----------|-----------|
| `REDIS_URL` | Ex.: `redis://redis:6379` |
| `REDIS_ENABLED` | `true` em produção |
| `ANALYSIS_SYNC_FALLBACK` | `false` — análise via fila assíncrona |
| `ANALYSIS_QUEUE_CONCURRENCY_GLOBAL` | Jobs simultâneos no worker (padrão: 10) |
| `ANALYSIS_QUEUE_CONCURRENCY_PER_TENANT` | Slots por tenant (padrão: 2) |
| `TENANT_QUOTA_ENABLED` | Controle de quotas por tenant |
| `TENANT_QUOTA_ANALYSIS_PER_DAY` | Limite diário de análises |
| `TENANT_QUOTA_UPLOADS_PER_HOUR` | Limite horário de uploads |

Template completo: `deploy/env/.env.production.example` (ou gere com `./deploy/scripts/setup-production-env.sh`).

## Health checks

- API: `GET /api/health`
- Deep health (Mongo, Redis, fila, auth, storage): `GET /api/health/deep`
- Worker: `pgrep -f runAnalysisWorker` no container `doqyn-worker`

## Logs

```bash
cd deploy
docker compose -f docker-compose.production.yml --env-file .env logs -f doqyn-api doqyn-worker redis
```

## TLS

O compose expõe HTTP na porta configurada (`HTTP_PORT`, padrão 80). Use Certbot no host, Cloudflare ou outro terminador TLS na frente do Nginx.
