# DOQYN — Plano de escala, resiliência e robustez (B2B)

**Versão:** 1.0  
**Data:** 2026-07-11  
**Escopo:** doqyn-alpha-document-intelligence + doqyn-auth-service  
**Meta de negócio:** ~4.000 clientes B2B no primeiro ano  
**Status:** documento de implementação — **não é código**

> **Nota sobre IA:** o provedor atual é **Groq** (classificação + extração via LLM). A decisão de produto é **descontinuar Groq** e adotar **Google Cloud Vision AI** (e serviços complementares do Google Cloud) como caminho principal. **Esta migração não será implementada neste ciclo**; o plano abaixo prepara a arquitetura para trocar o provedor sem reescrever o produto.

---

## Sumário

1. [Objetivos e princípios](#1-objetivos-e-princípios)
2. [Estado atual (baseline)](#2-estado-atual-baseline)
3. [Arquitetura alvo](#3-arquitetura-alvo)
4. [SLOs e limites operacionais](#4-slos-e-limites-operacionais)
5. [Roadmap por fases](#5-roadmap-por-fases)
6. [Fase A — Fundação (sem mudar provedor IA)](#6-fase-a--fundação-sem-mudar-provedor-ia)
7. [Fase B — Escala operacional](#7-fase-b--escala-operacional)
8. [Fase C — Escala B2B (1000+ tenants)](#8-fase-c--escala-b2b-1000-tenants)
9. [Banco de dados — Postgres e MongoDB](#9-banco-de-dados--postgres-e-mongodb)
10. [Fila de processamento e workers](#10-fila-de-processamento-e-workers)
11. [Cache de sessão e auth em escala](#11-cache-de-sessão-e-auth-em-escala)
12. [Rate limiting e quotas por tenant](#12-rate-limiting-e-quotas-por-tenant)
13. [Storage (R2) e upload em escala](#13-storage-r2-e-upload-em-escala)
14. [Preview PDF / CPU-bound](#14-preview-pdf--cpu-bound)
15. [Observabilidade e alertas](#15-observabilidade-e-alertas)
16. [Deploy, alta disponibilidade e DR](#16-deploy-alta-disponibilidade-e-dr)
17. [Migração futura: Groq → Google Vision AI](#17-migração-futura-groq--google-vision-ai)
18. [Runbooks de incidente](#18-runbooks-de-incidente)
19. [Checklist de aceite por fase](#19-checklist-de-aceite-por-fase)
20. [Apêndice — mapa de arquivos](#20-apêndice--mapa-de-arquivos)

---

## 1. Objetivos e princípios

### 1.1 Objetivos mensuráveis (ano 1)

| Métrica | Meta conservadora | Meta agressiva |
|---------|-------------------|----------------|
| Tenants ativos (empresas) | 4.000 cadastrados | 4.000 |
| Tenants com uso semanal | ~400 (10%) | ~800 (20%) |
| Usuários simultâneos (pico) | 200–500 | 1.000+ |
| Requisições API (pico sustentado) | 100–300 req/s | 500 req/s |
| Análises de documento (pico) | 20–50 paralelas globais | 100+ via fila |
| Disponibilidade mensal (API + auth) | 99,5% | 99,9% |
| Tempo de login (p95) | < 400 ms | < 250 ms |
| Listagem biblioteca (p95) | < 800 ms | < 500 ms |
| Análise de PDF (p95, assíncrona) | < 90 s | < 60 s |

### 1.2 Princípios de arquitetura

1. **Degradação graciosa** — IA lenta ou indisponível não derruba login, listagem nem download.
2. **Stateless na borda** — API HTTP escalável horizontalmente; estado em Redis/DB/fila.
3. **Isolamento por tenant** — cota, fila e métricas por `tenantId`; evitar noisy neighbor.
4. **Idempotência** — retries de upload, análise e confirmação não duplicam documentos.
5. **Observabilidade primeiro** — toda melhoria de escala vem com métrica e alerta.
6. **Evolutivo, não big bang** — manter monólito modular; extrair workers antes de microserviços.
7. **Provedor de IA plugável** — contrato interno estável; Groq hoje, Google Vision amanhã.

### 1.3 O que NÃO fazer neste ciclo

- Migrar para Kubernetes “completo” no dia 1.
- Implementar Google Vision AI (apenas documentar contrato e fase futura).
- Sharding Mongo antes de métricas reais de volume.
- Microserviços para cada domínio (auth já está separado — suficiente por agora).

---

## 2. Estado atual (baseline)

### 2.1 Topologia de deploy (produção VPS)

```
Internet → nginx (Docker, :80)
              ├── /           → SPA (build Vite embutido no Dockerfile.nginx)
              ├── /api/*      → doqyn-api:3001 (tsx + dev-server.ts)
              ├── /auth/*     → auth-api:4100 (node dist)
              └── /oauth/*    → auth-api:4100

Interno Docker:
  postgres-auth, mongo, auth-api, doqyn-api
```

**Arquivos:** `deploy/docker-compose.production.yml`, `deploy/nginx/default.conf`, `docker/Dockerfile.api`, `docker/Dockerfile.nginx`.

### 2.2 Gargalos críticos identificados no código

| # | Gargalo | Impacto em escala | Severidade |
|---|---------|-------------------|------------|
| G1 | `POST /api/ai/analyze-pdf` **síncrono** (2× Groq + PDF parse + staging) | Threads Node bloqueadas; timeout nginx 120s | **Crítico** |
| G2 | Verify de sessão **sem cache** em toda request autenticada | Latência + carga Postgres auth | **Crítico** |
| G3 | Rate limit auth **in-memory** (`Map`) | Ineficaz com N réplicas | **Alto** |
| G4 | Fila de upload **no browser** (1 PDF por vez) | Servidor ainda processa request longa | **Alto** |
| G5 | Mongo pool fixo `maxPoolSize: 10` | Saturação sob concorrência | **Alto** |
| G6 | Health `/api/health` **não testa** Mongo/R2/auth | Falso positivo em deploy | **Médio** |
| G7 | API produção via **tsx** (não compilada) | CPU/memória piores que `node dist` | **Médio** |
| G8 | Preview Ghostscript **no mesmo container** da API | Contenção CPU | **Médio** |
| G9 | Duas filas de upload no frontend | Divergência de comportamento | **Médio** |
| G10 | Sync membro auth→Mongo **fire-and-forget** | Inconsistência eventual | **Baixo** |

### 2.3 Dependências externas

| Sistema | Repo | Variáveis principais |
|---------|------|----------------------|
| MongoDB | alpha | `MONGODB_URI`, `MONGODB_DATABASE` |
| PostgreSQL | auth | `DATABASE_URL` |
| Cloudflare R2 | alpha | `STORAGE_PROVIDER`, `R2_*` |
| Groq (temporário) | alpha | `GROQ_API_KEY`, `GROQ_*`, `PDF_ANALYSIS_*` |
| GeoIP offline | alpha | `GEOIP_CITY_DB_PATH`, `geolite2-redist` |
| SMTP | auth | `SMTP_*`, tenant outbound email |

---

## 3. Arquitetura alvo

### 3.1 Diagrama lógico (12–18 meses)

```
                         ┌─────────────────────────────────────┐
                         │  CDN / WAF / Load Balancer (TLS)    │
                         └──────────────────┬──────────────────┘
                                            │
              ┌─────────────────────────────┼─────────────────────────────┐
              │                             │                             │
              ▼                             ▼                             ▼
       ┌─────────────┐              ┌─────────────┐              ┌─────────────┐
       │  API HTTP   │   ×N         │  API HTTP   │              │  Auth API   │   ×M
       │  (stateless)│              │  (stateless)│              │  (Fastify)  │
       └──────┬──────┘              └──────┬──────┘              └──────┬──────┘
              │                             │                             │
              │         ┌───────────────────┴───────────────────┐         │
              │         │              Redis Cluster             │         │
              │         │  • session cache  • rate limits          │         │
              │         │  • job queue (BullMQ)  • pub/sub         │         │
              │         └───────────────────┬───────────────────┘         │
              │                             │                             │
              ▼                             ▼                             ▼
       ┌─────────────┐              ┌─────────────┐              ┌─────────────┐
       │   Workers   │   ×W         │  MongoDB    │              │ PostgreSQL  │
       │ analyze     │              │  Atlas M10+ │              │ + PgBouncer │
       │ preview     │              └─────────────┘              └─────────────┘
       │ notifications│                     │
       └──────┬──────┘                     ▼
              │                      ┌─────────────┐
              ▼                      │ Cloudflare  │
       ┌─────────────┐              │     R2      │
       │ IA Provider │              └─────────────┘
       │ (Vision AI) │  ← fase futura
       └─────────────┘
```

### 3.2 Separação de workloads

| Workload | Onde roda | Característica |
|----------|-----------|----------------|
| CRUD documentos, listagens, sharing | API HTTP | I/O bound, baixa latência |
| Login, sessão, admin auth | Auth API | I/O bound, segurança |
| Análise PDF + IA | Worker dedicado | CPU + I/O, 30–120s |
| Preview Ghostscript | Worker dedicado | CPU intensivo |
| Confirmação / persistência | API HTTP ou worker leve | Transacional Mongo + R2 |

### 3.3 Contrato interno de IA (provedor agnóstico)

Independente de Groq ou Google Vision, o domínio deve expor:

```typescript
// Contrato alvo (novo módulo — implementar na Fase A como interface, Groq como adapter)

interface DocumentAnalysisProvider {
  /** Extrai texto estruturado do PDF (OCR se necessário). */
  extractText(input: PdfAnalysisInput): Promise<TextExtractionResult>;

  /** Classifica documento contra regras do tenant. */
  classify(input: ClassificationInput): Promise<ClassificationResult>;

  /** Extrai metadados conforme regras de extração. */
  extractMetadata(input: MetadataExtractionInput): Promise<MetadataExtractionResult>;
}

interface PdfAnalysisInput {
  tenantId: string;
  jobId: string;
  requestId: string;
  pdfBuffer: Buffer;
  fileName: string;
  maxPages: number;
  maxInputChars: number;
}
```

**Local sugerido:** `server/ai/providers/` (novo diretório).

- `groqProvider.ts` — adapter atual (temporário).
- `googleVisionProvider.ts` — stub vazio até fase de migração.
- `documentAnalysisOrchestrator.ts` — pipeline que hoje está em `analyzePdfService.ts`.

---

## 4. SLOs e limites operacionais

### 4.1 SLOs por superfície

| Superfície | SLI | SLO (ano 1) | Janela |
|------------|-----|-------------|--------|
| Auth login | % 2xx em < 2s | 99,5% | 30 dias |
| API autenticada (excl. IA) | % 2xx em < 1s p95 | 99,5% | 30 dias |
| Análise assíncrona | job concluído em < 120s p95 | 95% | 30 dias |
| Disponibilidade auth | health OK | 99,9% | 30 dias |
| Disponibilidade API | deep health OK | 99,5% | 30 dias |

### 4.2 Limites padrão por tenant (configuráveis)

| Recurso | Default | Enterprise (futuro) |
|---------|---------|---------------------|
| Uploads / hora | 60 | 500 |
| Análises IA / dia | 200 | 2.000 |
| Páginas PDF / análise | 10 | 50 |
| Tamanho arquivo | 15 MB | 25 MB |
| Requisições API / min (por tenant) | 300 | 3.000 |
| Storage total | por contrato | por contrato |

**Persistência sugerida:** campo `quotas` em `tenants` (Mongo registry) + cache Redis.

### 4.3 Circuit breakers

| Dependência | Abrir após | Half-open após | Fallback |
|-------------|------------|----------------|----------|
| Groq (atual) | 5 falhas / 30s | 60s | `ai_unavailable` + fila retry |
| Google Vision (futuro) | 5 falhas / 30s | 60s | idem |
| Auth verify | 10 falhas / 10s | 30s | 503 + retry client |
| Mongo | 3 timeouts / 5s | 30s | 503 |
| R2 | 5 erros 5xx / 30s | 60s | 503 upload |

---

## 5. Roadmap por fases

```
Fase A (4–8 semanas)     Fundação: Redis, fila, cache sessão, health deep, quotas básicas
Fase B (8–16 semanas)    Escala: workers, API compilada, N réplicas, PgBouncer, Atlas
Fase C (16–24 semanas)   B2B: autoscaling, read path analytics, DR testado, planos/quotas
Fase IA (paralela, TBD)  Groq → Google Vision AI (não iniciar até Fase A estável)
```

| Fase | Entregáveis | Risco se pular |
|------|-------------|----------------|
| A | Sistema aguenta pilotos pagos (50–100 tenants) | Picos derrubam API |
| B | Centenas de tenants com uso real | Custo e incidentes frequentes |
| C | Meta 4.000 tenants cadastrados | Noisy neighbor, DR failure |
| IA | Custos previsíveis, OCR melhor | Lock-in Groq, limites TPD |

---

## 6. Fase A — Fundação (sem mudar provedor IA)

> **Objetivo:** desacoplar o caminho quente, introduzir Redis, tornar operações observáveis. Groq permanece como adapter.

### A.1 — Ticket A-01: Introduzir Redis no compose e config

**Problema:** sem Redis não há fila distribuída, cache de sessão nem rate limit global.

**Implementação:**

1. Adicionar serviço `redis` em `deploy/docker-compose.production.yml`:
   - imagem `redis:7-alpine`
   - volume persistente `redis_data`
   - healthcheck `redis-cli ping`
   - **não** expor porta publicamente

2. Variáveis em `deploy/env/.env.production.example` e setup script:
   ```env
   REDIS_URL=redis://redis:6379
   REDIS_KEY_PREFIX=doqyn:
   ```

3. Novo módulo `server/redis/redisClient.ts`:
   - singleton `ioredis` ou `redis` v4
   - `getRedisClient()`, `closeRedis()`
   - reconnect com backoff

4. Dev local: `deploy/docker-compose.dev.yml` + Redis opcional.

**Critérios de aceite:**
- [ ] `redis-cli ping` OK dentro da rede Docker
- [ ] API sobe com `REDIS_URL` e loga "Redis connected"
- [ ] API sobe **sem** Redis em dev com feature flag `REDIS_ENABLED=false` (fallback in-memory documentado)

**Estimativa:** 2–3 dias.

---

### A.2 — Ticket A-02: Interface `DocumentAnalysisProvider` + adapter Groq

**Problema:** pipeline acoplado a Groq; troca futura para Vision AI exigiria rewrite.

**Implementação:**

1. Criar `server/ai/providers/types.ts` — contratos da seção 3.3.

2. Criar `server/ai/providers/groqDocumentAnalysisProvider.ts`:
   - mover lógica de `documentClassifierAgent.ts` + `metadataExtractorAgent.ts` + `groqClient.ts` para trás do adapter
   - manter `groqClient.ts` como client de baixo nível

3. Criar `server/ai/providers/googleVisionDocumentAnalysisProvider.ts`:
   - **stub** que lança `AiAnalysisError('NOT_IMPLEMENTED', ...)` ou retorna `requires_review`
   - comentário: "Fase IA — não implementar agora"

4. Criar `server/ai/providers/resolveAnalysisProvider.ts`:
   ```typescript
   export function resolveAnalysisProvider(): DocumentAnalysisProvider {
     const provider = process.env.DOCUMENT_ANALYSIS_PROVIDER ?? 'groq';
     if (provider === 'google_vision') throw new Error('Google Vision not enabled yet');
     return groqDocumentAnalysisProvider;
   }
   ```

5. Refatorar `server/ai/services/analyzePdfService.ts` para usar orchestrator + provider.

**Critérios de aceite:**
- [ ] Todos os testes existentes de analyze passam (`tests/document-signature.test.ts`, `tests/groq-analysis-pipeline.test.ts`, etc.)
- [ ] `DOCUMENT_ANALYSIS_PROVIDER=groq` (default) comportamento idêntico
- [ ] `DOCUMENT_ANALYSIS_PROVIDER=google_vision` retorna erro claro (não crash silencioso)

**Estimativa:** 5–7 dias.

---

### A.3 — Ticket A-03: Fila de análise assíncrona (BullMQ)

**Problema:** G1 — request HTTP segura até 120s com 2 chamadas Groq.

**Design:**

```
POST /api/ai/analyze-pdf
  → valida auth + quota + arquivo
  → cria job Mongo (processing_jobs) status=queued
  → enfileira BullMQ job { jobId, tenantId, userId, stagingKey }
  → 202 { jobId, status: 'queued', pollUrl: '/api/ai/jobs/:jobId' }

GET /api/ai/jobs/:jobId
  → { status: queued|processing|completed|failed|requires_review, progress?, result? }

Worker (novo processo):
  → consome fila
  → chama analyzePdfService (via provider)
  → atualiza job + staging
  → rate limit concurrency global + por tenant
```

**Arquivos novos/alterados:**

| Arquivo | Ação |
|---------|------|
| `server/workers/analysisWorker.ts` | **novo** — processo worker |
| `server/queues/analysisQueue.ts` | **novo** — BullMQ queue + opts |
| `api/ai/analyze-pdf.ts` | alterar para enqueue (modo async) |
| `api/ai/jobs/[jobId].ts` | **novo** — polling |
| `server/db/types.ts` | status de job expandido |
| `docker/Dockerfile.worker` | **novo** — imagem worker |
| `deploy/docker-compose.production.yml` | serviço `doqyn-worker` |

**Configuração:**

```env
ANALYSIS_QUEUE_CONCURRENCY_GLOBAL=10
ANALYSIS_QUEUE_CONCURRENCY_PER_TENANT=2
ANALYSIS_JOB_TTL_HOURS=24
ANALYSIS_SYNC_FALLBACK=false   # true só em dev
```

**Modo compatibilidade (dev):** `ANALYSIS_SYNC_FALLBACK=true` mantém resposta síncrona atual.

**Frontend (fase A.3b — pode ser A.4):**

| Arquivo | Mudança |
|---------|---------|
| `src/features/document-send/services/analyzePdf.ts` | após POST, poll `GET /api/ai/jobs/:id` até terminal |
| `src/features/upload/UploadQueueProvider.tsx` | usar poll; reduzir timeout client para ~30s de *espera de enqueue* |

**Critérios de aceite:**
- [ ] Upload de 10 PDFs em sequência não bloqueia API de listagem
- [ ] Worker restart não perde job (BullMQ persistence)
- [ ] Job idempotente: mesmo `jobId` não processa duas vezes
- [ ] Métrica `analysis_queue_depth` exportada

**Estimativa:** 10–15 dias (backend + frontend).

---

### A.4 — Ticket A-04: Cache de sessão (Redis)

**Problema:** G2 — cada request autenticada chama `POST /internal/sessions/verify`.

**Design:**

```
verifyDoqynAuthSession():
  1. cacheKey = sha256(sessionToken) + activeTenantHint
  2. Redis GET → hit → retorna (TTL 45s)
  3. miss → fetch auth → SET com TTL
  4. em logout/revoke (webhook interno ou TTL curto) → invalidar
```

**Arquivos:**

| Arquivo | Mudança |
|---------|---------|
| `server/auth/providers/doqynAuthProvider.ts` | cache read-through |
| `server/auth/sessionCache.ts` | **novo** |
| `server/auth/authConfig.ts` | `SESSION_CACHE_TTL_SECONDS=45` |

**Invalidação:**

- TTL curto (45s) já limita risco de sessão revogada stale
- Fase B: auth publica evento `session.revoked` → alpha invalida chave

**Critérios de aceite:**
- [ ] Com cache quente, verify auth cai > 80% em load test (ex.: 100 req/s listagem)
- [ ] Logout reflete em até TTL segundos (documentado)
- [ ] Cache desabilitável via `SESSION_CACHE_ENABLED=false`

**Estimativa:** 3–5 dias.

---

### A.5 — Ticket A-05: Health check profundo

**Problema:** G6 — `/api/health` não testa dependências.

**Novo endpoint:** `GET /api/health/deep` (interno ou protegido)

```json
{
  "status": "ok|degraded|down",
  "checks": {
    "mongo": { "ok": true, "latencyMs": 12 },
    "redis": { "ok": true },
    "r2": { "ok": true },
    "auth": { "ok": true, "latencyMs": 8 },
    "analysisQueue": { "ok": true, "waiting": 3, "active": 2 },
    "aiProvider": { "name": "groq", "configured": true }
  }
}
```

**Arquivos:**

| Arquivo | Mudança |
|---------|---------|
| `api/health.ts` | manter liveness simples |
| `api/health/deep.ts` | **novo** |
| `deploy/docker-compose.production.yml` | HC do `doqyn-api` usa `/api/health/deep` |

**Critérios de aceite:**
- [ ] Deploy não marca healthy se Mongo down
- [ ] `status: degraded` se Redis down mas API responde (modo fallback)

**Estimativa:** 2–3 dias.

---

### A.6 — Ticket A-06: Pool Mongo configurável + índices em CI

**Problema:** G5 — `maxPoolSize: 10` fixo.

**Mudanças:**

1. `server/db/mongoClient.ts`:
   ```typescript
   maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE ?? 50),
   minPoolSize: Number(process.env.MONGODB_MIN_POOL_SIZE ?? 5),
   maxIdleTimeMS: 30_000,
   serverSelectionTimeoutMS: 5_000,
   ```

2. Documentar fórmula: `pool ≥ replicas_api × workers × concorrência_média_por_processo`.

3. Pipeline CI/CD: rodar `scripts/ensure-mongodb-indexes.ts` pós-deploy (já existe job one-shot).

**Critérios de aceite:**
- [ ] Variáveis documentadas em `.env.example`
- [ ] Load test 50 conexões simultâneas sem `MongoPoolClearedError`

**Estimativa:** 1–2 dias.

---

### A.7 — Ticket A-07: Quotas básicas por tenant

**Problema:** sem limite, um tenant pode esgotar IA e CPU.

**Implementação mínima:**

1. `server/tenancy/tenantQuotas.ts` — leitura de quotas (defaults + override em `tenants`).

2. Middleware `assertTenantQuota(action)` antes de:
   - `analyze-pdf` → `analysis_per_day`
   - `upload` → `uploads_per_hour`

3. Contador Redis: `INCR` com TTL diário/horário por `tenantId`.

4. Resposta 429 com código `TENANT_QUOTA_EXCEEDED` e `retryAfter`.

**Critérios de aceite:**
- [ ] Tenant que estoura cota recebe 429 claro
- [ ] Métrica `quota_exceeded_total{tenantId}` (cardinalidade: top tenants apenas)

**Estimativa:** 4–5 dias.

---

### A.8 — Ticket A-08: Unificar filas de upload no frontend

**Problema:** G9 — `UploadQueueProvider` vs `useBulkUploadQueue`.

**Plano:**

1. Extrair `src/features/upload/queue/uploadQueueCore.ts` — lógica pura.
2. `useBulkUploadQueue` delega para mesma core ou deprecado.
3. Uma única máquina de estados documentada em `docs/UPLOAD_QUEUE.md`.

**Estimativa:** 5–8 dias.

---

## 7. Fase B — Escala operacional

### B.1 — API compilada para produção

**Problema:** G7 — `tsx server/dev-server.ts` em Docker.

**Plano:**

1. Criar `server/production-server.ts` ou compilar `dev-server.ts`.
2. `tsconfig.server.json` com `outDir: dist/server`.
3. `Dockerfile.api` CMD: `node dist/server/production-server.js`.
4. Manter `npm run dev:api` com tsx para desenvolvimento.

**Estimativa:** 5–7 dias.

---

### B.2 — Workers separados (analyze + preview)

**Serviços Docker:**

```yaml
doqyn-worker-analysis:
  build: Dockerfile.worker
  command: node dist/workers/analysisWorker.js
  deploy:
    replicas: 2

doqyn-worker-preview:
  build: Dockerfile.worker
  command: node dist/workers/previewWorker.js
  deploy:
    replicas: 1
```

**Fila preview:** jobs disparados após `confirm-analysis` (hoje síncrono em `documentPreviewService.ts`).

**Estimativa:** 10–12 dias.

---

### B.3 — Auth: PgBouncer + rate limit Redis

**Auth compose:**

```yaml
pgbouncer:
  image: edoburu/pgbouncer
  environment:
    DATABASE_URL: ...
    POOL_MODE: transaction
    MAX_CLIENT_CONN: 500
    DEFAULT_POOL_SIZE: 25
```

**Substituir** `src/security/rateLimit.ts` Map por Redis sliding window.

**Arquivos:** `doqyn-auth-service/src/security/rateLimitRedis.ts`.

**Estimativa:** 5–7 dias.

---

### B.4 — Horizontalizar API e Auth

**Requisitos antes de N réplicas:**

- [x] A.3 Fila (state fora do processo)
- [x] A.4 Cache sessão
- [x] B.3 Rate limit Redis no auth
- [ ] Sticky sessions **não** necessário (stateless + cookie)
- [ ] Upload via presigned URL (B.5)

**Load balancer:** nginx upstream ou cloud LB com health `deep`.

```nginx
upstream doqyn_api {
  least_conn;
  server doqyn-api-1:3001;
  server doqyn-api-2:3001;
  keepalive 32;
}
```

**Estimativa:** 3–5 dias infra + testes.

---

### B.5 — Presigned upload R2

**Problema:** PDF grande passa pelo Node duas vezes (upload + staging).

**Fluxo alvo:**

```
1. POST /api/documents/upload-url → { uploadUrl, stagingKey, expiresAt }
2. Browser PUT direto no R2
3. POST /api/ai/analyze-pdf { stagingKey } (sem multipart body)
```

**Arquivos:**

| Arquivo | Mudança |
|---------|---------|
| `api/documents/upload-url.ts` | **novo** |
| `server/storage/r2/r2PresignedUrls.ts` | **novo** |
| `src/features/document-send/services/analyzePdf.ts` | fluxo staging |

**Estimativa:** 7–10 dias.

---

### B.6 — MongoDB Atlas (migração do container)

**Checklist:**

1. Cluster M10+ (região próxima à VPS).
2. IP allowlist da VPS + workers.
3. `MONGODB_URI` Atlas SR connection string.
4. Rodar `ensure-mongodb-indexes` contra Atlas.
5. Backup contínuo Atlas + teste restore mensal.
6. Remover serviço `mongo` do compose produção (manter só dev).

**Estimativa:** 2–3 dias + validação.

---

## 8. Fase C — Escala B2B (1000+ tenants)

### C.1 — Autoscaling (API + workers)

- Métrica: `analysis_queue_waiting > 50` por 5 min → +1 worker.
- API: CPU > 70% por 10 min → +1 réplica.
- Ferramentas: Docker Swarm mode, Nomad, ou cloud managed (Fly.io, ECS).

### C.2 — Planos e quotas por contrato

- Tabela `tenant_plans` ou campo em auth tenant metadata.
- Quotas: storage GB, análises/mês, usuários, assinaturas.
- Billing integration (futuro).

### C.3 — Read path para analytics

- Tracking/audit export pesado → job assíncrono + CSV no R2.
- Opcional: read replica Mongo para dashboards (Atlas).

### C.4 — DR (Disaster Recovery)

| Cenário | RTO | RPO | Ação |
|---------|-----|-----|------|
| VPS down | 4h | 1h | Restore snapshot + compose up |
| Postgres corrupt | 2h | 15min | Restore volume backup |
| Mongo Atlas failover | 30min | automático | Atlas HA |
| R2 indisponível | — | 0 | Retry; upload pausado |

**Teste trimestral:** restore Postgres em staging + smoke test login.

### C.5 — Individual tenant pool (`compartilhado`)

Monitorar crescimento de `documents_compartilhado`. Se > 5M docs:
- Particionar PF por shard de `ownerUserId` ou migrar para dedicated prefix.

---

## 9. Banco de dados — Postgres e MongoDB

### 9.1 PostgreSQL (auth) — boas práticas

| Prática | Implementação | Prioridade |
|---------|---------------|------------|
| Connection pooling | PgBouncer transaction mode | B.3 |
| Índices | Prisma migrations (já existe) | — |
| Slow query log | `log_min_duration_statement=500` | B |
| Backup diário | `pg_dump` + volume snapshot | A |
| Retenção sessões | job cron limpa `auth_sessions` expiradas | B |
| Vacuum/Analyze | autovacuum default + monitor | C |
| Read replica | só se relatórios pesados no auth | C |

**Tabelas quentes em escala:**
- `auth_sessions` (verify a cada request sem cache)
- `auth_memberships` + joins de grupos
- `auth_audit_logs` (crescimento — política de retenção)

**Retenção sugerida audit auth:** 90 dias online, arquivo frio depois.

### 9.2 MongoDB (alpha) — boas práticas

| Prática | Status atual | Ação |
|---------|--------------|------|
| Índices por tenantId | `ensure-mongodb-indexes.ts` | CI pós-deploy |
| Collections prefixadas (business) | `tenantResolver.ts` | manter |
| Pool compartilhado (individual) | `compartilhado` | monitorar |
| TTL em jobs/staging | parcial | A.3 — TTL `processing_jobs` |
| Writes idempotentes | confirm usa `jobId` | reforçar testes |
| Transações multi-doc | onde necessário | revisar `confirmAnalysisService` |
| Backup | manual | Atlas continuous backup |

**Índices críticos (validar existência):**

```
documents_{prefix}: { tenantId: 1, status: 1, updatedAt: -1 }
documents_{prefix}: { tenantId: 1, "classification.classId": 1 }
processing_jobs: { tenantId: 1, status: 1, createdAt: -1 }
audit_logs: { tenantId: 1, createdAt: -1 }
```

### 9.3 Consistência auth ↔ Mongo

**Problema:** `scheduleTenantMemberSync()` é async sem garantia.

**Melhoria (Fase B):**

1. Auth chama sync com retry (3× backoff) antes de retornar approve membership.
2. Alpha expõe `GET /api/internal/tenant-members/:id/sync-status`.
3. Job noturno reconcilia diffs auth vs `tenant_members`.

---

## 10. Fila de processamento e workers

### 10.1 Filas recomendadas (BullMQ + Redis)

| Fila | Produtor | Consumidor | Prioridade |
|------|----------|------------|------------|
| `analysis` | API analyze-pdf | worker-analysis | alta |
| `preview` | confirm-analysis | worker-preview | média |
| `member-sync-retry` | auth webhook | worker-light | baixa |
| `notifications` (futuro) | vários | worker-notify | baixa |

### 10.2 Configuração BullMQ

```typescript
// server/queues/queueDefaults.ts
export const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { age: 86400, count: 1000 },
  removeOnFail: { age: 604800 },
};
```

### 10.3 Concorrência

```env
WORKER_ANALYSIS_CONCURRENCY=5        # por processo worker
WORKER_ANALYSIS_GLOBAL_MAX=20       # Redis semaphore
WORKER_ANALYSIS_PER_TENANT_MAX=2
```

### 10.4 Dead letter

- Após 3 falhas → `failed` permanente + alerta.
- Admin UI (futuro): reprocessar job.

---

## 11. Cache de sessão e auth em escala

### 11.1 Camadas de cache

```
Browser cookie (doqyn_session)
    → Alpha API (sessionCache Redis, TTL 45s)
        → Auth service (Postgres auth_sessions)
```

### 11.2 Dimensionamento auth

| Métrica | Estimativa 4k tenants |
|---------|----------------------|
| Sessões ativas/dia | 10k–50k |
| Verify sem cache | 500k–2M/dia (insustentável) |
| Verify com cache 45s | 50k–200k/dia |

**Conclusão:** cache de sessão é **obrigatório**, não opcional.

### 11.3 Auth horizontal

- Fastify stateless — OK para N réplicas.
- Rate limit **deve** ir para Redis antes de segunda réplica.
- `DATA_ENCRYPTION_KEY` — mesma chave em todas as réplicas (secret compartilhado).

---

## 12. Rate limiting e quotas por tenant

### 12.1 Camadas de rate limit

| Camada | Escopo | Implementação |
|--------|--------|---------------|
| Edge / WAF | IP global | Cloudflare (recomendado) |
| Nginx | IP, burst | `limit_req_zone` |
| Auth | login, reset | Redis sliding window |
| API | por tenant/user | Redis + middleware |
| Worker | análises | concurrency semáforo |

### 12.2 Middleware API (novo)

`server/middleware/tenantRateLimit.ts`:

```typescript
// Chaves Redis:
// ratelimit:tenant:{tenantId}:api:minute
// ratelimit:user:{userId}:api:minute
```

Aplicar em rotas caras: analyze, upload, preview, rag-query.

---

## 13. Storage (R2) e upload em escala

### 13.1 Estratégia atual (boa)

- `per_tenant` bucket mode — isolamento e lifecycle por cliente.
- Staging entre analyze e confirm — correto para fluxo de revisão.

### 13.2 Melhorias

1. **Presigned upload** (B.5) — reduz carga Node.
2. **Lifecycle rule** — apagar staging após 7 dias.
3. **Multipart upload** — arquivos > 15 MB (se limite subir).
4. **CDN** na frente de previews públicos (se sharing externo ativo).

### 13.3 Limites R2

- Monitorar `ListObjects` — evitar listagens frequentes; usar prefix + índice Mongo.

---

## 14. Preview PDF / CPU-bound

### 14.1 Situação

- Ghostscript em `server/preview/pdfPreviewGenerator.ts`, `ghostscriptOptimizer.ts`.
- Roda no mesmo processo que API hoje.

### 14.2 Alvo

- Worker `preview` com concurrency 2–4 por máquina.
- Fila disparada após confirm; UI mostra preview "gerando...".

### 14.3 Recursos

- Worker preview: CPU limit 2 cores, mem 2 GB por container.
- Não escalar API e preview juntos — métricas diferentes.

---

## 15. Observabilidade e alertas

### 15.1 Stack sugerida (pragmática)

| Componente | Opção open | Opção managed |
|----------|------------|---------------|
| Métricas | Prometheus + Grafana | Datadog |
| Logs | Loki ou Vector → arquivo | Axiom / Datadog |
| Traces | OpenTelemetry → Jaeger | Honeycomb |
| Erros | Sentry | Sentry |
| Uptime | Uptime Kuma | Better Uptime |

### 15.2 Métricas obrigatórias (Fase A)

**API:**
- `http_requests_total{method,route,status}`
- `http_request_duration_seconds{route,quantile}`
- `mongo_operation_duration_seconds`
- `session_cache_hit_ratio`
- `analysis_jobs_queued`, `analysis_jobs_active`, `analysis_jobs_failed`

**Worker:**
- `analysis_job_duration_seconds`
- `ai_provider_requests_total{provider,status}`
- `ai_provider_latency_seconds`

**Auth:**
- `auth_login_total{status}`
- `auth_session_verify_total{cache}` (quando auth tiver cache próprio)
- `auth_rate_limit_exceeded_total`

### 15.3 Alertas (Pager/Slack)

| Alerta | Condição | Severidade |
|--------|----------|------------|
| API down | deep health fail 2 min | P1 |
| Auth down | /health fail 1 min | P1 |
| Fila análise acumulando | waiting > 100 por 10 min | P2 |
| Taxa erro 5xx > 5% | 5 min | P2 |
| Mongo latency p95 > 500ms | 10 min | P2 |
| Redis down | 1 min | P2 |
| Groq/Vision errors > 20% | 15 min | P3 |
| Disco VPS > 85% | — | P3 |

### 15.4 Logging estruturado

Padronizar em `server/utils/logger.ts`:

```json
{
  "level": "info",
  "msg": "analysis completed",
  "requestId": "...",
  "tenantId": "...",
  "userId": "...",
  "jobId": "...",
  "durationMs": 45230,
  "aiProvider": "groq"
}
```

**Nunca logar:** session token, PII crua, `GROQ_API_KEY`, conteúdo PDF.

---

## 16. Deploy, alta disponibilidade e DR

### 16.1 Evolução do deploy

| Estágio | Setup |
|---------|-------|
| Atual | 1 VPS, compose monolítico |
| Fase B | 1 VPS, compose com workers + Redis |
| Fase C | 2 VPS (app + DB) ou VPS + Atlas |
| Futuro | LB + 2+ VPS app, DB managed |

### 16.2 Compose alvo (Fase B)

```yaml
services:
  redis: ...
  postgres-auth: ...
  pgbouncer: ...
  auth-api: { deploy: { replicas: 2 } }  # swarm
  doqyn-api: { deploy: { replicas: 2 } }
  doqyn-worker-analysis: { deploy: { replicas: 2 } }
  doqyn-worker-preview: { replicas: 1 }
  nginx: ...
```

### 16.3 Secrets

- `deploy/.env` chmod 600 — nunca no git.
- Produção futura: Docker secrets ou Vault.
- Rotação trimestral: `DOQYN_INTERNAL_API_KEY`, `DOQYN_APP_INTERNAL_API_KEY`.

### 16.4 Backup

| Dado | Frequência | Retenção |
|------|------------|----------|
| Postgres volume | diário | 30 dias |
| Mongo Atlas | contínuo | plano Atlas |
| Redis | snapshot diário (opcional) | 7 dias |
| R2 | versioning opcional | lifecycle |
| `deploy/.env` | manual criptografado | indefinido |

---

## 17. Migração futura: Groq → Google Vision AI

> **Não implementar neste ciclo.** Esta seção é o blueprint para quando a Fase A (provider interface + fila) estiver estável.

### 17.1 Por que trocar

| Aspecto | Groq (atual) | Google Vision AI (alvo) |
|---------|--------------|-------------------------|
| OCR / PDF escaneado | Fraco (depende de pdf-parse texto) | **Forte** (OCR nativo) |
| Classificação semântica | LLM JSON | Precisa camada adicional (Vertex AI / regras) |
| Limites | TPD/TPM agressivos em free | Quotas GCP contratuais |
| Custo previsível | Variável | Billing GCP por página |
| Latência | Baixa em texto | OCR maior, paralelizável |

### 17.2 Arquitetura alvo com Vision AI

```
PDF upload
  → Worker analysis
      1. Google Document AI / Vision OCR → texto + bounding boxes por página
      2. Normalização texto (mesmo chunker atual)
      3. Classificação:
           opção A: regras + embeddings (sem LLM)
           opção B: Vertex AI Gemini com JSON schema (substituto do Groq)
      4. Extração campos:
           opção A: Document AI custom extractor (form parser)
           opção B: Gemini + schema por regra de extração
      5. Mesmo fluxo requires_review / confirm
```

### 17.3 Serviços GCP candidatos

| Serviço | Uso no DOQYN |
|---------|--------------|
| **Cloud Vision API** | OCR página a página (PDF rasterizado ou imagens) |
| **Document AI** | Form parser, invoice parser, custom processors |
| **Cloud Storage (GCS)** | Opcional: espelho temporário se R2 → GCP bridge |
| **Vertex AI (Gemini)** | Classificação/extração JSON se regras não bastarem |

**Decisão pendente de produto:** Vision-only vs Document AI vs híbrido Vision + Gemini.

### 17.4 Interface de implementação (quando chegar a hora)

```
server/ai/providers/googleVisionDocumentAnalysisProvider.ts
server/ai/clients/googleVisionClient.ts
server/ai/clients/documentAiClient.ts   (se Document AI)
```

**Variáveis (.env futuro):**

```env
DOCUMENT_ANALYSIS_PROVIDER=google_vision
GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/gcp-sa.json
# ou WORKLOAD_IDENTITY em GKE

VISION_OCR_LANGUAGE_HINTS=pt,en
DOCUMENT_AI_PROCESSOR_ID=          # se usar Document AI
VERTEX_GEMINI_MODEL=gemini-2.0-flash  # se classificação via LLM Google
```

### 17.5 Estratégia de migração (canary)

1. **Fase IA-0:** stub + feature flag `DOCUMENT_ANALYSIS_PROVIDER=google_vision` só em dev.
2. **Fase IA-1:** shadow mode — worker chama Groq e Vision em paralelo, compara resultados, persiste diff em collection `analysis_shadow_logs` (não afeta UX).
3. **Fase IA-2:** canary 5% tenants `beta_vision=true` em registry.
4. **Fase IA-3:** 50% → 100%; desligar Groq.
5. **Fase IA-4:** remover `groq-sdk`, `groqClient.ts`, variáveis `GROQ_*`.

### 17.6 Impacto no frontend

- Nenhum se contrato `AnalyzePdfResponse` mantido estável.
- Polling de jobs (A.3) abstrai tempo de OCR maior.

### 17.7 Testes de migração

| Teste | Descrição |
|-------|-----------|
| Fixture PDFs | 50 PDFs representativos (nativo, escaneado, NF, contrato) |
| Paridade | classId e campos críticos ≥ 90% match Groq vs Vision |
| Performance | p95 OCR + classificação < 120s |
| Custo | custo médio por documento < meta financeira |

### 17.8 Remoção Groq (checklist final — futuro)

- [ ] Remover `groq-sdk` de `package.json`
- [ ] Remover `server/ai/services/groqClient.ts`
- [ ] Remover env vars `GROQ_*` de `.env.example`
- [ ] Atualizar testes `tests/groq-analysis-pipeline.test.ts` → `tests/document-analysis-pipeline.test.ts`
- [ ] Atualizar mensagens de erro em `uploadQueueAnalysis.ts` (sem menção Groq)
- [ ] Documentar custos Vision no runbook

---

## 18. Runbooks de incidente

### 18.1 Fila de análise acumulada

**Sintoma:** `analysis_jobs_waiting > 100`, usuários reclamam de PDF parado.

**Ações:**
1. Verificar worker: `docker compose logs doqyn-worker-analysis`
2. Se Groq 429: pausar enqueue (`ANALYSIS_QUEUE_PAUSED=true`) + banner UI
3. Escalar workers (+1 réplica)
4. Se PDFs grandes: verificar timeout e quota tenant

### 18.2 Auth lento / down

**Sintoma:** login 503, API toda lenta.

**Ações:**
1. `curl /health` auth
2. Postgres: `docker compose logs postgres-auth`
3. PgBouncer stats (Fase B)
4. Alpha: desabilitar cache não — aumentar TTL temporariamente **não** recomendado

### 18.3 Mongo latency

**Ações:**
1. Atlas metrics ou `mongosh` `db.currentOp()`
2. Índice faltando? rodar `ensure-mongodb-indexes`
3. Tenant específico? verificar quota de writes

### 18.4 R2 indisponível

**Ações:**
1. Upload retorna 503 claro
2. Análise que já tem staging local pode continuar; novos bloqueados
3. Status page / comunicação clientes

### 18.5 VPS disco cheio

**Ações:**
1. `docker system prune` (cuidado com volumes)
2. Logs rotation
3. Mover Mongo para Atlas se container local

---

## 19. Checklist de aceite por fase

### Fase A — concluída quando:

- [ ] Redis em produção
- [ ] Fila BullMQ processando análises
- [ ] Frontend faz polling de jobs
- [ ] Cache de sessão ativo
- [ ] Health deep no deploy
- [ ] Pool Mongo configurável
- [ ] Quotas básicas por tenant
- [ ] Interface `DocumentAnalysisProvider` + Groq adapter
- [ ] Stub Google Vision presente (não funcional)
- [ ] Métricas Prometheus expostas (`/metrics`)
- [ ] Load test: 50 usuários virtuais listando biblioteca — p95 < 1s
- [ ] Load test: 10 análises paralelas — API não degrada listagem

### Fase B — concluída quando:

- [ ] API compilada (sem tsx em produção)
- [ ] Workers analysis + preview separados
- [ ] PgBouncer + rate limit Redis no auth
- [ ] 2 réplicas API atrás de nginx
- [ ] Presigned upload R2
- [ ] MongoDB Atlas em produção
- [ ] Backup restore testado

### Fase C — concluída quando:

- [ ] Autoscaling workers validado
- [ ] DR drill trimestral documentado
- [ ] Quotas por plano comercial
- [ ] 99,5% uptime mensal medido
- [ ] Runbooks exercitados

### Fase IA (futuro) — concluída quando:

- [ ] Shadow mode 2 semanas sem regressão crítica
- [ ] 100% tráfego em Google Vision
- [ ] Groq removido do codebase
- [ ] Custos por documento dentro da meta

---

## 20. Apêndice — mapa de arquivos

### Alpha — auth e tenancy

| Arquivo | Responsabilidade |
|---------|------------------|
| `server/auth/providers/doqynAuthProvider.ts` | Verify sessão |
| `server/auth/requireAuth.ts` | Middleware |
| `server/tenancy/documentRequestContext.ts` | Contexto por request |
| `server/tenancy/tenantResolver.ts` | Prefixo collections |
| `server/tenancy/collectionGuard.ts` | Anti-flat writes |

### Alpha — IA (atual Groq)

| Arquivo | Responsabilidade |
|---------|------------------|
| `server/ai/services/analyzePdfService.ts` | Orquestração |
| `server/ai/services/groqClient.ts` | Client Groq |
| `server/ai/services/documentClassifierAgent.ts` | Classificação |
| `server/ai/services/metadataExtractorAgent.ts` | Extração |
| `api/ai/analyze-pdf.ts` | HTTP entrada |

### Alpha — upload frontend

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/features/upload/UploadQueueProvider.tsx` | Fila biblioteca |
| `src/features/document-send/hooks/useBulkUploadQueue.ts` | Fila bulk (deprecar) |
| `src/features/document-send/services/analyzePdf.ts` | HTTP client |

### Alpha — infra

| Arquivo | Responsabilidade |
|---------|------------------|
| `deploy/docker-compose.production.yml` | Stack produção |
| `deploy/nginx/default.conf` | Proxy |
| `docker/Dockerfile.api` | API container |
| `docker/Dockerfile.nginx` | Nginx + SPA |
| `server/dev-server.ts` | Router API local |

### Auth

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/modules/internal/internal.routes.ts` | `/internal/sessions/verify` |
| `src/security/rateLimit.ts` | Rate limit in-memory |
| `src/integrations/memberSync.ts` | Sync → alpha |
| `prisma/schema.prisma` | Schema Postgres |

---

## Controle de documento

| Versão | Data | Autor | Mudanças |
|--------|------|-------|----------|
| 1.0 | 2026-07-11 | Arquitetura DOQYN | Versão inicial |

**Próximo passo recomendado:** iniciar **A-01 (Redis)** e **A-02 (interface provider)** em paralelo — são pré-requisitos de tudo else, incluindo a futura migração para Google Vision AI.
