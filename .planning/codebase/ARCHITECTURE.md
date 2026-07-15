<!-- refreshed: 2026-07-15 -->
# Architecture

**Analysis Date:** 2026-07-15

## System Overview

```text
┌───────────────────────────────────────────────────────────────────────────┐
│                     Frontend SPA (React 19 + Vite, :5173)                 │
│  `src/app` (router/providers) · `src/features/*` (domain modules)         │
│  `src/auth` (doqyn_auth client) · `src/components` (design system)        │
└───────────────┬───────────────────────────────────┬───────────────────────┘
                │ fetch /api/*                       │ fetch /auth/*, /oauth/*
                ▼                                     ▼
┌───────────────────────────────────┐   ┌─────────────────────────────────────┐
│  DOQYN Alpha API (Node, :3001)    │   │  doqyn-auth-service (Fastify, :4100) │
│  `api/**/*.ts` handlers            │   │  sibling repo: doqyn-auth-service    │
│  `server/**` business logic        │◄──┤  Prisma + PostgreSQL, session cookie │
│  dispatched by `server/apiServer.ts`│  │  `POST /internal/sessions/verify`    │
└───────┬───────────┬───────────┬───┘   └─────────────────────────────────────┘
        │           │           │              (Bearer internal API key)
        ▼           ▼           ▼
   MongoDB      Redis/BullMQ   Cloudflare R2 (S3 API) / local disk
 (tenant-       (analysis +    `server/storage/r2/*`,
  prefixed      preview queues) `server/storage/localStorageProvider.ts`
  collections)  `server/queues/*`
        │           │
        ▼           ▼
`server/tenancy/*`   `server/workers/*` (analysisWorker, previewWorker)
                            │
                            ▼
                  Groq (classification/extraction) +
                  Google Cloud Vision (OCR fallback)
                  `server/ai/**`
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Vercel-style API handlers | One file per route, thin HTTP glue (auth check → call service → respond) | `api/**/*.ts` |
| Dev/prod HTTP dispatcher | Maps URL → handler module for local Node server (mirrors Vercel routing) | `server/apiServer.ts` |
| Business services | Core domain logic (documents, tenants, signatures, sharing, tracking...) | `server/services/*.ts` |
| Tenancy layer | Resolves tenant, builds per-tenant Mongo collection handles, storage scope, quotas | `server/tenancy/*.ts` |
| Auth layer | Session verification (doqyn_auth or legacy temporary JWT), role/permission checks | `server/auth/*.ts` |
| AI pipeline | PDF text extraction, OCR fallback, classification, metadata extraction | `server/ai/**` |
| Queues/workers | Async analysis and preview generation via BullMQ, with in-process fallback | `server/queues/*.ts`, `server/workers/*.ts` |
| Storage abstraction | Uniform interface over R2 (S3) or local filesystem | `server/storage/storageProvider.ts`, `server/storage/r2/*` |
| Mongo data access | Raw `mongodb` driver client, DB name resolution, index management | `server/db/*.ts` |
| Frontend routing/shell | Router, layout, providers, lazy-loaded route components | `src/app/*.tsx` |
| Domain feature modules | Self-contained UI + API client + hooks per business area | `src/features/<name>/*` |
| Auth client | doqyn_auth session fetch/cache, cookie-based auth context for React | `src/auth/*.ts` |
| Design system | Shared UI primitives (buttons, popovers, layout chrome) | `src/components/ui/*`, `src/components/layout/*` |
| Sibling identity service | Independent Fastify/Prisma/Postgres service owning users, tenants, memberships, sessions | `doqyn-auth-service/src/**` (separate repo) |

## Pattern Overview

**Overall:** Modular monolith with a Vercel-style serverless API convention (one file per route, `export default handler(req, res)`), backed by a service layer, deployed either as Vercel functions or as a single long-running Node process (`server/apiServer.ts`) for VPS/Docker. The identity/auth domain is fully extracted into a separate microservice (`doqyn-auth-service`).

**Key Characteristics:**
- File-based routing convention borrowed from Vercel (`api/<path>.ts` = `/api/<path>`), but actually executed by a hand-rolled dispatcher (`server/apiServer.ts`) for both dev and single-process production — no actual Vercel platform dependency at runtime.
- Multi-tenant data isolation via **per-tenant MongoDB collection name prefixes** (business tenants: `documents_{tenantId}`; individual/PF tenants: shared pool collections filtered by `ownerUserId`) rather than a shared collection with a tenant column.
- Auth/identity fully delegated to a sibling service; the Alpha app never talks to Postgres directly, only to `doqyn-auth-service` over HTTP with a shared internal API key, plus a Redis-backed session cache to avoid re-verifying on every request.
- Long-running AI/OCR/preview work is offloaded to BullMQ workers backed by Redis, with an in-process worker fallback (`ANALYSIS_WORKER_IN_PROCESS`) for simpler deployments/dev.
- Frontend organized by **feature module** (`src/features/<domain>`), each owning its own `api/`, `components/`, `hooks/`, `utils/` — not by technical layer.

## Layers

**API handlers (`api/`):**
- Purpose: HTTP entrypoints; parse request, enforce auth/tenant context, delegate to a service, shape the JSON/binary response.
- Location: `api/**/*.ts`
- Contains: One handler per endpoint (e.g. `api/documents/upload.ts`, `api/signature-requests/[signatureRequestId]/sign.ts`), exporting `default async function handler(req, res)` typed with `@vercel/node`.
- Depends on: `server/auth/*`, `server/tenancy/*`, `server/services/*`, `server/utils/serviceErrors.ts`.
- Used by: `server/apiServer.ts` route table (dev/production dispatcher) and, if deployed on Vercel, the platform's own file-based router.

**Business services (`server/services/`):**
- Purpose: Encapsulate domain logic (document lifecycle, sharing, signatures, audit, tenants, dashboard aggregation).
- Location: `server/services/*.ts` (plus subfolders `server/services/analysis`, `server/services/confirm`, `server/services/favorites`, `server/services/preview`, `server/services/profile`, `server/services/sharing`, `server/services/signatures`, `server/services/tracking`, `server/services/trash`)
- Contains: Functions taking plain data + tenant/user context, returning results or throwing `ServiceError`.
- Depends on: `server/tenancy/getTenantCollections.ts` (Mongo collection access), `server/storage/*`, `server/ai/*`, `server/db/types.ts`.
- Used by: `api/**` handlers, workers.

**Tenancy layer (`server/tenancy/`):**
- Purpose: Resolve which tenant a request belongs to, compute tenant-prefixed Mongo collection names, resolve storage scope (R2 bucket/prefix or local path), enforce quotas.
- Location: `server/tenancy/*.ts`
- Contains: `getTenantCollections.ts`, `tenantResolver.ts` (implied), `documentRequestContext.ts`, `resolveTenantStorageScope.ts`, `tenantQuotas.ts`, `documentAccess.ts`, `documentOwnership.ts`, `documentShareAccess.ts`.
- Depends on: `server/db/mongoClient.ts`, `server/auth/tenantContext.ts`.
- Used by: virtually every `api/documents/**`, `api/company-members/**`, `api/governance/**` handler.

**Auth layer (`server/auth/`):**
- Purpose: Verify session (doqyn_auth cookie via sibling service, or legacy `temporary` JWT), map to `AuthUser`, enforce role/group checks.
- Location: `server/auth/*.ts`, `server/auth/providers/doqynAuthProvider.ts`
- Contains: `requireAuth.ts` (entry guard used by handlers), `sessionCache.ts` (Redis cache of verified sessions), `authConfig.ts` (provider switch), `permissions.ts`.
- Depends on: `doqyn-auth-service` HTTP API (`/internal/sessions/verify`), Redis, `server/utils/serviceErrors.ts`.
- Used by: `server/tenancy/documentRequestContext.ts` and directly by handlers needing plain auth (e.g. `api/me.ts`).

**AI pipeline (`server/ai/`):**
- Purpose: Turn an uploaded PDF/image into extracted text, a document classification, and structured metadata.
- Location: `server/ai/services/*.ts`, `server/ai/providers/*.ts`, `server/ai/vision/*.ts`, `server/ai/utils/*.ts`
- Contains: `analyzePdfService.ts` / `analyzePdfUpdateService.ts` (orchestrators), `documentTextExtractor.ts`/`pdfTextExtractor.ts`, `documentClassifierAgent.ts`, `metadataExtractorAgent.ts`, Groq client (`groqClient.ts`), Google Vision OCR fallback (`visionOcrService.ts`).
- Depends on: Groq SDK, `@google-cloud/vision`, `pdf-parse`/`pdfjs-dist`.
- Used by: `api/ai/analyze-pdf.ts`, `server/workers/analysisWorker.ts`.

**Queues & workers (`server/queues/`, `server/workers/`):**
- Purpose: Run PDF analysis and preview/thumbnail generation asynchronously, with per-tenant concurrency limits.
- Location: `server/queues/analysisQueue.ts`, `server/queues/analysisTenantConcurrency.ts`, `server/queues/previewQueue.ts`, `server/workers/analysisWorker.ts`, `server/workers/previewWorker.ts`, `server/workers/runAnalysisWorker.ts` (standalone process entry), `server/workers/runPreviewWorker.ts`
- Contains: BullMQ job producers/consumers backed by `ioredis`.
- Depends on: Redis (`server/redis/redisClient.ts`), `server/ai/services/*`, `server/storage/*` (staging buffer retrieval), `server/services/analysis/analysisJobService.ts`.
- Used by: `api/documents/upload.ts` / `api/ai/analyze-pdf.ts` (enqueue), standalone `npm run dev:worker` / `start:worker` processes, or in-process fallback started from `server/apiServer.ts`.

**Storage abstraction (`server/storage/`):**
- Purpose: Present one interface for "put/get/delete/presign a file" regardless of backend.
- Location: `server/storage/storageProvider.ts` (interface), `server/storage/getStorageProvider.ts` (factory), `server/storage/r2/*.ts` (Cloudflare R2 / S3 implementation), `server/storage/localStorageProvider.ts` (disk fallback for dev)
- Depends on: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`.
- Used by: `server/services/documentService.ts`, `server/services/documentFileService.ts`, analysis workers (staging objects).

**Data access (`server/db/`):**
- Purpose: Own the single MongoDB connection, canonical database name resolution, index bootstrap, and shared Mongo document types.
- Location: `server/db/mongoClient.ts`, `server/db/database.ts` (DB name), `server/db/constants.ts` (legacy flat collection names — see Anti-Patterns), `server/db/types.ts`, `server/db/tenantIndexes.ts` + per-feature index files.
- Used by: `server/tenancy/getTenantCollections.ts` and, indirectly, all services.

**Frontend app shell (`src/app/`):**
- Purpose: Compose providers (React Query, auth), define the router, lazy-load route-level feature entry points.
- Location: `src/app/App.tsx`, `src/app/providers.tsx`, `src/app/routes.tsx`, `src/app/lazyRoutes.tsx`, `src/app/queryClient.ts`, `src/app/layout/WorkspaceLayout.tsx`
- Depends on: `src/features/auth/ProtectedRoute.tsx`, `src/components/layout/AppLayout.tsx`.

**Frontend feature modules (`src/features/`):**
- Purpose: One folder per business domain (documents, upload, library, signature, governance/rules, sharing, tracking, audit, dashboard, settings, users, profile, onboarding flows). Each is internally layered: `api/` (fetch wrappers), `components/`, `hooks/`, `utils/`, `types.ts`.
- Location: `src/features/<domain>/**`
- Depends on: `src/lib/api.ts` (fetch wrapper), `@tanstack/react-query`, `src/auth/*`.
- Used by: `src/app/lazyRoutes.tsx` (route-level code splitting per feature).

**Frontend auth client (`src/auth/`):**
- Purpose: Client-side session handling for the `doqyn_auth` cookie-based provider — fetch `/api/me`, cache/normalize session shape, expose `useAuth()`.
- Location: `src/auth/AuthProvider.tsx`, `src/auth/useAuth.ts`, `src/auth/sessionApi.ts`, `src/auth/authServiceClient.ts`, `src/auth/mapMeSession.ts`
- Note: distinct from `src/features/auth/*`, which wraps `src/auth` behind a pluggable `auth-provider` abstraction (`temporary` vs `doqyn_auth`) used by `ProtectedRoute`/`PublicRoute`.

## Data Flow

### Primary Request Path (document upload → AI analysis → persistence)

1. User drops a file in the upload UI; `src/features/upload/services/startUploadFromFiles.ts` builds a queue item and calls the analyze API (`src/features/upload/services/analyzePdf.ts`).
2. `POST /api/ai/analyze-pdf` (`api/ai/analyze-pdf.ts`) authenticates via `requireDocumentRequestContext` (`server/tenancy/documentRequestContext.ts`), stages the file buffer to storage, and enqueues or synchronously runs analysis (`server/ai/services/analyzePdfService.ts`).
3. If queued, `server/workers/analysisWorker.ts` picks up the BullMQ job, loads the staged buffer (`server/storage/index.ts`), extracts text (`server/ai/services/documentTextExtractor.ts`, OCR fallback via `server/ai/vision/visionOcrService.ts`), classifies (`documentClassifierAgent.ts`) and extracts metadata (`metadataExtractorAgent.ts`) via Groq.
4. Frontend polls/streams job status (`api/ai/jobs/[jobId].ts`), then calls `POST /api/documents/confirm-analysis` (`server/services/confirmAnalysisService.ts`) once the user reviews/confirms extracted metadata.
5. `confirmAnalysisService` persists the document + first version + chunks into tenant-prefixed Mongo collections (via `getTenantCollections`), moves the file from staging to permanent storage, writes an audit log entry, and triggers preview/thumbnail generation (`server/queues/previewQueue.ts` → `server/workers/previewWorker.ts`).

### Authentication Flow

1. Browser calls `POST /auth/login` — proxied by Vite (`vite.config.ts`) directly to `doqyn-auth-service` at `:4100`; the Alpha API is not involved.
2. `doqyn-auth-service` sets an HttpOnly session cookie (`doqyn_session`) and returns membership info.
3. Frontend calls `GET /api/me` (`api/me.ts` → `server/services/meService.ts`), which forwards the cookie's session token to the auth-service's `POST /internal/sessions/verify` endpoint using a shared `DOQYN_AUTH_INTERNAL_API_KEY` Bearer token (`server/auth/providers/doqynAuthProvider.ts`).
4. Verified sessions are cached in Redis (`server/auth/sessionCache.ts`) keyed by session token, to avoid round-tripping to the auth-service on every API call.
5. Every subsequent authenticated API call runs `requireAuth`/`requireDocumentRequestContext`, which re-checks the cached/verified session and derives `tenantId`, `userId`, `membershipId`, and role/group claims used for authorization.

**State Management:**
- Server: stateless per-request; all persistent state lives in MongoDB (documents/metadata), Cloudflare R2/local disk (binaries), Redis (BullMQ job queues + session cache + rate limits), and PostgreSQL inside `doqyn-auth-service` (identity/tenancy/memberships).
- Client: TanStack React Query owns all server-derived state (`src/app/queryClient.ts`); Zustand is a declared dependency (`package.json`) but no `src/stores/*` files currently use it — local/ephemeral UI state is otherwise handled with component state, contexts (`src/contexts/*`), and feature-local hooks (e.g. `src/features/upload/queue/useUploadQueue.ts`).

## Key Abstractions

**`ServiceError` (typed domain error):**
- Purpose: Uniform way for any service function to signal a business-rule failure with an HTTP status code and machine-readable `code`.
- Examples: `server/utils/serviceErrors.ts` (definition), used throughout `server/services/*.ts` and `server/tenancy/*.ts`.
- Pattern: `throw new ServiceError(message, code, statusCode)`; handlers catch with `isServiceError(error)` and map directly to `res.status(error.statusCode).json({ message, code })` — see `api/documents/upload.ts`.

**`DocumentRequestContext` (tenant + storage + collections bundle):**
- Purpose: Single object threaded through document-related handlers/services carrying `tenantId`, `userId`, `membershipId`, resolved `storageScope`, and a `TenantCollections` handle.
- Examples: `server/tenancy/documentRequestContext.ts` (`requireDocumentRequestContext`, `buildDocumentRequestContext`).
- Pattern: Handlers call `const ctx = await requireDocumentRequestContext(req, res); if (!ctx) return;` at the top, then pass `ctx` into service calls instead of re-deriving tenant/user info.

**`TenantCollections` (per-tenant Mongo collection resolver):**
- Purpose: Resolve tenant-scoped, name-prefixed MongoDB collection handles once per request instead of hardcoding collection names.
- Examples: `server/tenancy/getTenantCollections.ts`, collection name resolution in `server/tenancy/tenantResolver.ts` (referenced), naming rules in `docs/MONGODB_TENANT_ISOLATION.md` / `docs/TENANT_STORAGE_MODEL.md`.
- Pattern: `const collections = await getTenantCollections(tenantId, {...}); collections.documents.find(...)` — never `db.collection('documents')` directly in service code.

**`StorageProvider` (pluggable file storage interface):**
- Purpose: Abstract over Cloudflare R2 (S3-compatible) vs local disk so services don't branch on environment.
- Examples: `server/storage/storageProvider.ts` (interface), `server/storage/r2/r2StorageProvider.ts`, `server/storage/localStorageProvider.ts`, factory in `server/storage/getStorageProvider.ts`.
- Pattern: Services call `getStorageProvider()` and use the returned object's `put`/`get`/`delete`/presign methods; environment (`STORAGE_PROVIDER` / R2 credentials presence) decides implementation at runtime.

**Vercel-style route handler (`(req, res) => Promise<unknown>`):**
- Purpose: Keep API code deployable both as literal Vercel serverless functions and as routes dispatched by the hand-rolled Node server.
- Examples: every file under `api/**/*.ts`; route table in `server/apiServer.ts`.
- Pattern: `export default async function handler(req: VercelRequest, res: VercelResponse) { ... }`; dynamic path segments follow Next.js/Vercel bracket convention (`api/documents/[documentId]/shares.ts`) and are manually re-mapped to regex routes in `server/apiServer.ts` for local/VPS execution.

**Feature module (frontend domain slice):**
- Purpose: Co-locate everything needed for one business capability so it can be lazy-loaded and reasoned about independently.
- Examples: `src/features/documents/*`, `src/features/upload/*`, `src/features/signature/*`, `src/features/rules/*` (governance flow with `@xyflow/react`).
- Pattern: `src/features/<name>/api/*Api.ts` (fetch wrappers over `src/lib/api.ts`), `hooks/use*.ts` (React Query hooks), `components/*.tsx`, optional `utils/`, `types.ts`; entry route component re-exported and lazy-loaded from `src/app/lazyRoutes.tsx`.

## Entry Points

**Frontend bootstrap:**
- Location: `src/main.tsx` → `src/app/App.tsx` → `src/app/providers.tsx` + `src/app/routes.tsx`
- Triggers: browser load of the Vite-built SPA.
- Responsibilities: mount React root, wrap in `StrictMode`, install React Query + auth providers, hand off to `react-router-dom`'s `RouterProvider`.

**Local/VPS API server:**
- Location: `server/dev-server.ts` (dev, `npm run dev:api`) and `server/production-server.ts` (prod, `npm run start:api`), both thin wrappers around `server/apiServer.ts` (`startApiServer`).
- Triggers: `npm run dev` (concurrently runs Vite + this) or `node dist/server/production-server.js` in Docker/VPS.
- Responsibilities: init Prometheus metrics, connect Redis, optionally start in-process analysis worker, start plain Node `http.createServer` with manual route resolution mirroring `api/**` file structure, expose GeoIP lookups for tracking.

**Vercel serverless functions (alternate deploy target):**
- Location: each `api/**/*.ts` file individually, per Vercel's file-based routing convention (implied by `@vercel/node` devDependency and Vercel-shaped handler signatures; primary deployment per `docs/DEPLOY_VPS.md` is Docker/VPS via `server/production-server.ts`, not Vercel).

**Standalone analysis/preview workers:**
- Location: `server/workers/runAnalysisWorker.ts` (`npm run dev:worker` / `start:worker`), `server/workers/runPreviewWorker.ts` (`npm run dev:worker:preview` / `start:worker:preview`)
- Triggers: run as separate long-lived processes (e.g. separate Docker service) when analysis is not run in-process.
- Responsibilities: consume BullMQ jobs from Redis, execute the same worker logic as the in-process fallback (`server/workers/analysisWorker.ts` / `previewWorker.ts`).

**Sibling auth service entry point:**
- Location: `doqyn-auth-service/src/server.ts` (repo root: `/home/a1rm4x/Documents/GitHub/doqyn-auth-service`)
- Triggers: independently deployed/run Fastify service, listens on port `4100` locally.
- Responsibilities: user/tenant/membership/session CRUD and verification, backed by Prisma + PostgreSQL; exposes `/internal/sessions/verify` consumed by this repo's `server/auth/providers/doqynAuthProvider.ts`.

## Architectural Constraints

- **Threading:** Single-threaded Node.js event loop for both the API process and each worker process; concurrency for CPU-bound work (PDF parsing, OCR) relies on async I/O and BullMQ horizontal worker processes, not Node worker_threads.
- **Global state:** Module-level singletons for the Mongo client (`server/db/mongoClient.ts`), Redis client (`server/redis/redisClient.ts`), and a `workerStarted` boolean guard in `server/workers/analysisWorker.ts` preventing duplicate in-process worker registration. Prometheus metrics registry is also a module-level singleton (`server/metrics/prometheus.ts`).
- **Route table duplication:** `server/apiServer.ts` hand-maintains a route table (static map + regex patterns) that must be kept in sync with the actual files under `api/**`; adding a new `api/*.ts` file does not automatically make it reachable outside a real Vercel deployment — it must also be registered in `staticRoutes`/`patterns` in `server/apiServer.ts`.
- **Cross-repo coupling:** This repo and `doqyn-auth-service` must be run together in development and kept in sync on shared secrets (`DOQYN_AUTH_INTERNAL_API_KEY` / `DOQYN_INTERNAL_API_KEY`, `DOQYN_APP_INTERNAL_API_KEY`, `DOQYN_AUTH_COOKIE_NAME` / `SESSION_COOKIE_NAME`) — see `docs/ENV_SYNC.md` and the `env:auth-sync` script.
- **Legacy auth path:** An older `AUTH_PROVIDER=temporary` (local JWT, no auth-service) code path still exists (`server/auth/tempUser.ts`, `/api/auth/login`) alongside the official `doqyn_auth` path; both are live in `requireAuth.ts`/`requireDocumentRequestContext` via `usesDoqynAuth()` branching.

## Anti-Patterns

### Writing to "flat" (non-tenant-prefixed) Mongo collections

**What happens:** Legacy code paths reference flat collection names from `server/db/constants.ts` (`COLLECTIONS`) directly, bypassing per-tenant collection prefixing.
**Why it's wrong:** Breaks tenant data isolation — the whole multi-tenancy model depends on every document/version/chunk/audit write going through a tenant-prefixed collection resolved via `getTenantCollections`/`getTenantDbCollections`.
**Do this instead:** Always obtain collections through `server/tenancy/getTenantCollections.ts`. The project enforces this with a dedicated guard script, `scripts/assert-no-flat-tenant-writes.ts` (`npm run audit:no-flat-writes`), which greps for writes to flat collection names outside an explicit allowlist (migrations, `server/tenancy/`, `server/db/setupMongo.ts`).

### Hardcoding a new `api/` route without updating the dispatcher

**What happens:** A new file added under `api/**/*.ts` following Vercel conventions is not reachable when running via `npm run dev:api` / `start:api`, because `server/apiServer.ts` resolves routes from its own hardcoded `staticRoutes`/`patterns` tables rather than scanning the filesystem.
**Why it's wrong:** Leads to "works nowhere until you edit a second file" bugs — a very easy oversight since the file-based convention looks self-describing.
**Do this instead:** Any new endpoint requires a matching entry added to `server/apiServer.ts` (exact path in `staticRoutes`, or a regex `RoutePattern` for dynamic segments) in addition to the handler file itself.

### Mixing `AUTH_PROVIDER=temporary` assumptions into new code

**What happens:** New code sometimes needs `user.tenantId`/`user.companyId`/`role` fields that behave slightly differently between the `doqyn_auth` and legacy `temporary` providers (see the dual mapping logic in `server/auth/requireAuth.ts` and `mapDoqynSessionToAuthUser`).
**Why it's wrong:** The `temporary` path is explicitly legacy (README: "não é o fluxo oficial") and diverging behavior between the two paths causes subtle bugs only visible in one auth mode.
**Do this instead:** Write new authorization logic against the `AuthUser` type (`server/auth/types.ts`) and the `doqyn_auth` flow only; treat `temporary` as a frozen compatibility shim, not a target for new features.

## Error Handling

**Strategy:** Domain/business errors are raised as typed `ServiceError` instances (`server/utils/serviceErrors.ts`) carrying an HTTP status code, a machine-readable `code`, and optional structured `details`/`payload`; handlers catch and translate them, everything else falls back to a generic 500.

**Patterns:**
- Service layer: `throw new ServiceError('Sessão inválida.', 'INVALID_SESSION', 401)` — never return `null`/ad-hoc error objects for expected failure modes.
- API handler layer: `try { ... } catch (error) { if (isServiceError(error)) return res.status(error.statusCode).json({ message: error.message, code: error.code }); return res.status(500).json({ message: ... }); }` — see `api/documents/upload.ts`, `server/auth/requireAuth.ts`.
- Worker layer: BullMQ's `DelayedError` is used intentionally to requeue jobs (e.g. tenant concurrency slot not available in `server/workers/analysisWorker.ts`) and is explicitly re-thrown rather than treated as a failure; all other errors are logged via `pipelineError`/`logger.error` and recorded in Prometheus (`recordAnalysisJobCompletion`) before propagating to BullMQ's retry mechanism.

## Cross-Cutting Concerns

**Logging:** Structured logger (`server/utils/logger.ts`) plus a dedicated AI/analysis pipeline debug logger (`server/ai/utils/pipelineDebug.ts` — `pipelineInfo`/`pipelineError`/`summarizeError`) used across the analysis worker and AI services for consistent field names (`jobId`, `tenantId`, `jobKind`, etc.).

**Validation:** `zod` schemas are the standard for request/body validation across both this repo and `doqyn-auth-service` (shared dependency); look for `z.object(...)` near handler/service boundaries.

**Authentication:** Centralized through `requireAuth`/`requireDocumentRequestContext`/`requireDocumentAuthContext` (`server/auth/requireAuth.ts`, `server/tenancy/documentRequestContext.ts`) — handlers should never parse cookies or call the auth-service directly.

**Metrics:** Prometheus client (`prom-client`) wired in `server/metrics/prometheus.ts`, recording HTTP request durations (`recordHttpRequest`, normalized route labels via `server/metrics/apiRouteLabel.ts`) and analysis job outcomes (`recordAnalysisJobCompletion`); scraped via `/api/metrics` and visualized through the Grafana/Prometheus stack under `deploy/observability/`.

---

*Architecture analysis: 2026-07-15*
