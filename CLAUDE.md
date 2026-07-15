<!-- GSD:project-start source:PROJECT.md -->
## Project

**DOQYN Alpha — Document Intelligence**

A multi-tenant SaaS platform for document management with AI-assisted classification, metadata extraction, e-signature, sharing, and governance workflows. React 19 SPA + Vercel-style Node API, MongoDB primary datastore, Redis/BullMQ for async AI analysis and preview generation, Cloudflare R2 for file storage. Identity/auth is fully delegated to a sibling microservice (`doqyn-auth-service`, Fastify + PostgreSQL). Deployed via Docker Compose on a self-managed VPS (Hostinger).

**Core Value:** Tenants can securely upload, analyze, and manage documents — the system must stay reliable and fast as real tenant load grows, not just work in demos.

### Constraints

- **Deployment target**: Hostinger VPS via Docker Compose (`deploy/docker-compose.production.yml`) — resource limits must be sized to a real, limited VPS plan, not assumed-generous cloud defaults.
- **Scope discipline**: This milestone is P1-only by explicit user decision; P2-P4 findings and new features must not be pulled in opportunistically during execution.
- **No live-migration risk**: Pre-launch status means structural/breaking changes (e.g., deleting legacy auth) are acceptable without a migration path.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript (strict mode) - used across frontend (`src/`), backend API handlers (`api/`), server runtime (`server/`), and shared code (`shared/`)
- Bash - deployment/ops scripts (`deploy/scripts/*.sh`, `scripts/mongo-backup-before-cleanup.sh`)
- SQL - implicit via Prisma migrations in the sibling `doqyn-auth-service` repo (not this repo)
## Runtime
- Node.js 22 (Docker images pin `node:22-bookworm-slim`, see `docker/Dockerfile.api`, `docker/Dockerfile.worker`, `docker/Dockerfile.web`)
- No `.nvmrc` or `engines` field present in `package.json` — Node version is only enforced via Docker base images
- npm (lockfile present: `package-lock.json`)
- Install: `npm ci` in Docker builds
## Frameworks
- React 19.1 (`react`, `react-dom`) - UI library
- React Router 7.5 (`react-router-dom`) - client-side routing
- Vite 6.3 (`vite`, `@vitejs/plugin-react`) - dev server & build tool, config in `vite.config.ts`
- TanStack React Query 5.74 (`@tanstack/react-query`) - server-state/data-fetching cache
- Zustand 5.0 (`zustand`) - client-side state stores (`src/stores/`)
- React Hook Form 7.56 + Zod 3.24 (`react-hook-form`, `@hookform/resolvers`, `zod`) - forms and schema validation
- Tailwind CSS 3.4 (`tailwindcss`, `postcss.config.js`, `tailwind.config.js`) - styling
- `@xyflow/react` 12.11 - node/graph diagram UI (governance rules map, `src/features/rules`)
- `@dnd-kit/core` / `@dnd-kit/utilities` - drag-and-drop interactions
- No HTTP framework wrapper — API routes are plain Vercel-style serverless handlers under `api/**/*.ts` (Vercel Node functions, `@vercel/node` types), and a lightweight custom dev/production Node HTTP server (`server/dev-server.ts`, `server/production-server.ts`) that dispatches to those same handler modules outside Vercel
- BullMQ 5.80 (`bullmq`) - Redis-backed job queues for async document analysis and PDF preview generation (`server/queues/`, `server/workers/`)
- Node built-in test runner via `tsx --test` (`npm test` → `tsx --test tests/**/*.test.ts`) - no Jest/Vitest in this repo (contrast with `doqyn-auth-service`, which uses Vitest)
- Ad hoc smoke-test scripts for AI provider under `scripts/test-groq-*.mjs`, `scripts/test-no-ai.mjs`
- `tsx` 4.19 - TypeScript execution for dev server, workers, and all `scripts/*.ts` maintenance/ops scripts
- `esbuild` 0.25 - used by `scripts/build-server.mjs` to bundle the server/API code for production (`build:server` step)
- TypeScript 5.8 (project-references setup: `tsconfig.json` → `tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.server.json`)
- ESLint 9 flat config (`eslint.config.js`) + `typescript-eslint` 8.30
- Prettier 3.5 (`.prettierrc`) with `prettier-plugin-tailwindcss` for class sorting
- `concurrently` 10.0 - runs API dev server + Vite dev server together (`npm run dev`)
## Key Dependencies
- `mongodb` 7.3 - official MongoDB driver, primary datastore (`server/db/mongoClient.ts`, `server/db/mongoConfig.ts`)
- `groq-sdk` 1.3 - Groq LLM API client for document classification & metadata extraction (`server/ai/services/groqClient.ts`, `server/ai/providers/groqDocumentAnalysisProvider.ts`)
- `@google-cloud/vision` 5.3 - Google Cloud Vision OCR client for scanned PDFs/images (`server/ai/vision/visionOcrService.ts`); disabled by default (`VISION_OCR_ENABLED=false`)
- `@aws-sdk/client-s3` 3.1077 + `@aws-sdk/s3-request-presigner` 3.1085 - S3-compatible client used against Cloudflare R2 for document storage (`server/storage/r2/`)
- `jose` 6.2 - JWT signing/verification, used both for legacy local session tokens (`server/auth/session.ts`) and for internal service-to-service auth
- `ioredis` 5.11 - Redis client for BullMQ queues, session cache, and tenant quotas (`server/redis/`)
- `zod` 3.24 - runtime schema validation shared across API request/response payloads
- `pdf-lib` 1.17, `pdf-parse` 2.4, `pdfjs-dist` 4.10 - PDF manipulation/parsing (metadata extraction, page counting) and in-browser PDF rendering
- `sharp` 0.34 - image processing (avatar resizing, preview thumbnails)
- `bcryptjs` 3.0 - password hashing (legacy/local auth paths)
- `qrcode` 1.5 - QR code generation for signature/verification flows (`server/services/signatures/`)
- `geoip-lite` 2.0 / `geolite2-redist` 3.1 / `maxmind` 5.0 - offline GeoIP lookups for security/audit tracking (`server/utils`, tracking service)
- `prom-client` 15.1 - Prometheus metrics exporter (`server/metrics/prometheus.ts`)
- `nanoid` 5.1 - ID generation
- `cookie` 1.1 - cookie parsing/serialization for session handling
- `@vercel/node` 5.1 (devDependency) - type definitions/runtime shim for Vercel serverless function signature, also used for local Vercel-shaped deployment (`vercel.json`)
- `dotenv` 16.5 - env var loading in dev/scripts context
## Configuration
- All runtime configuration via environment variables, documented exhaustively in `.env.example` (Portuguese comments)
- `.env` exists locally (gitignored) — contents not inspected (forbidden per security policy)
- Config is read directly from `process.env` inside dedicated config modules rather than a centralized config object, e.g. `server/auth/authConfig.ts`, `server/db/mongoConfig.ts`, `server/redis/redisConfig.ts`, `server/ai/vision/visionConfig.ts`, `server/config/externalSharingConfig.ts`, `server/config/signatureConfig.ts`
- A cross-repo env-sync contract exists between this repo and `doqyn-auth-service`: certain vars must match byte-for-byte between the two `.env` files (`DOQYN_AUTH_INTERNAL_API_KEY` ↔ auth's `DOQYN_INTERNAL_API_KEY`, `DOQYN_APP_INTERNAL_API_KEY`, `DOQYN_AUTH_COOKIE_NAME` ↔ auth's `SESSION_COOKIE_NAME`). Validated via `npm run env:auth-sync` (`scripts/env-auth-sync-check.mjs`) and documented in `docs/ENV_SYNC.md`.
- `vite.config.ts` - frontend build/dev config; path alias `@` → `./src`; manual chunk splitting for `pdfjs-dist`, React, TanStack Query, dnd-kit; dev-server proxies `/api` → `http://localhost:3001` and `/auth`, `/oauth` → `http://127.0.0.1:4100` (the auth service)
- `scripts/build-server.mjs` (esbuild) - bundles `api/`, `server/`, `shared/` into `dist/` for production Node execution
- `tsconfig.server.json` - NodeNext module resolution, ES2022 target, strict mode, covers `api/**`, `server/**`, `shared/**`
- `vercel.json` - rewrites for social-preview crawlers (OG image bot detection) and SPA fallback routing, used when deployed to Vercel as an alternative to the Docker/VPS path
## Platform Requirements
- Node 22, npm
- Local MongoDB (Docker Compose profile `local-mongo`) or MongoDB Atlas
- Optional local Redis for queue/session-cache testing (`REDIS_ENABLED=false` by default in dev — falls back to sync processing)
- Sibling `doqyn-auth-service` running locally on port 4100 for auth flows to work (`DOQYN_AUTH_BASE_URL=http://127.0.0.1:4100`)
- Ghostscript binary required for PDF preview generation (installed in Docker image; must be available locally too for `dev:worker:preview`)
- Docker Compose stack (`deploy/docker-compose.production.yml`) orchestrating: `postgres-auth`, `pgbouncer`, `auth-migrate`, `auth-api` (all from the sibling auth-service repo, built via relative path `../../doqyn-auth-service`), `mongo` (optional profile), `redis`, `doqyn-api`, `doqyn-api-indexes` (one-shot Mongo index job), `doqyn-worker` (analysis), `doqyn-worker-preview`, `nginx` (reverse proxy + static frontend), plus optional `--profile observability` services (`redis-exporter`, `prometheus`, `grafana`)
- Alternative deployment target: Vercel (`vercel.json` present, `@vercel/node` types) for the frontend + API routes, though the documented/primary production path is the Docker/VPS Compose stack
- Custom Docker images: `docker/Dockerfile.api` (Node 22 + Ghostscript + sharp deps), `docker/Dockerfile.worker`, `docker/Dockerfile.web`, `docker/Dockerfile.nginx`
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- React components: `PascalCase.tsx` — e.g. `src/components/ui/Button.tsx`, `src/features/library/components/FileRow.tsx`
- Hooks: `useX.ts` camelCase with `use` prefix — e.g. `src/features/library/hooks/useFavorites.ts`, `src/hooks/`
- Plain modules (services, utils, types): `camelCase.ts` — e.g. `server/utils/serviceErrors.ts`, `shared/metadataKeyNormalize.ts`
- API route handlers (Vercel-style file routing): lowercase/kebab path segments mirroring the endpoint, dynamic segments in brackets — e.g. `api/documents/[documentId]/favorite.ts`, `api/favorites/documents.ts`
- Test files: `kebab-case.test.ts`, one file per feature/topic, always under `tests/` (flat, not co-located) — e.g. `tests/document-favorites.test.ts`, `tests/r2-storage.test.ts`
- Scripts: `kebab-case.ts` or `.mjs` for one-off/audit scripts — e.g. `scripts/audit-mongodb-schema.ts`, `scripts/mongo-audit.mjs`
- camelCase, verb-first — `addDocumentFavorite`, `removeDocumentFavorite`, `listFavoriteDocuments`, `buildDocumentListItems`, `resolveDocumentId`
- Boolean-returning helpers prefixed `is`/`has`/`can` — `isServiceError`, `isMongoNativeConfigured`, `canUserListDocumentWithShare`
- Private/internal helpers not exported are declared above their public callers in the same file (e.g. `activeFavoriteFilter`, `getFavoritesCollection` in `server/services/favorites/documentFavoritesService.ts`)
- camelCase throughout; constants that are truly fixed values use `UPPER_SNAKE_CASE` — e.g. `DOCUMENT_CATEGORY_ID_PREFIX` in `server/utils/entityIds.ts`, `SHARED_APP_COLLECTIONS` in `server/db/constants.ts`
- IDs use string prefixes to disambiguate entity type at a glance — `fav_${randomUUID()}`, `cat_`, `group_`
- PascalCase for types/interfaces, no `I` prefix — `DocumentListItem`, `AuthUser`, `DocumentRequestContext`, `MongoUserDocumentFavorite`
- Mongo-persisted document shapes prefixed `Mongo` — `MongoDocument`, `MongoUserDocumentFavorite` (in `server/db/types.ts`)
- `type` used for unions/shape aliases, `interface` less common; prefer `type` for React prop shapes
## Code Style
- Prettier (`.prettierrc`): `semi: true`, `singleQuote: true`, `trailingComma: "all"`, `printWidth: 100`
- Plugin: `prettier-plugin-tailwindcss` — Tailwind class lists in JSX get auto-sorted
- Run via `npm run format` (`prettier --write "src/**/*.{ts,tsx,css}" "api/**/*.ts" "server/**/*.ts"`) — note `scripts/` and `tests/` are NOT included in the format glob
- ESLint flat config (`eslint.config.js`) using `typescript-eslint` recommended + `eslint-plugin-react-hooks` recommended + `eslint-plugin-react-refresh`
- Applies to `**/*.{ts,tsx}`, ignores `dist` and `node_modules`
- Key rule: `react-refresh/only-export-components` set to `warn` (allows constant exports alongside components, e.g. `buttonVariants.ts` co-located with `Button.tsx`)
- Run via `npm run lint` (`eslint .`)
- `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedSideEffectImports`
- `verbatimModuleSyntax: true` — `import type` must be used explicitly for type-only imports (seen consistently: `import type { VercelRequest, VercelResponse } from '@vercel/node'`)
- `moduleResolution: "bundler"`, `allowImportingTsExtensions: true` — server/script files import relative modules with explicit `.js`/`.ts` extensions (see below)
## Import Organization
- `@/*` → `src/*`
- `@shared/*` → `shared/*`
- Used pervasively in `src/` (frontend) — e.g. `import { useAuth } from '@/auth/useAuth'`
- `server/` and `api/` code does NOT use aliases; it uses relative paths with explicit extensions instead — e.g. `import { ServiceError } from '../../utils/serviceErrors.js'`. **When adding server-side code, always import with the `.js` extension even though the source is `.ts`** (this matches the compiled ESM output and is required by `verbatimModuleSyntax`/`bundler` resolution).
- Explicit `import type { ... }` for types re-exported or used only as annotations — enforced by convention across the codebase, not just where TS requires it.
## Error Handling
- Services throw `new ServiceError(message, code, statusCode)` for expected/business-rule failures (not found, access denied, not configured) — see `server/services/favorites/documentFavoritesService.ts:75,96,111`
- API handlers (`api/**/*.ts`) wrap logic in try/catch and translate `ServiceError` to an HTTP response; unknown errors are **rethrown**, never swallowed:
- Error messages returned to the client are written in Portuguese (pt-BR) and paired with a machine-readable `code` (e.g. `DOCUMENT_NOT_FOUND`, `DOCUMENT_ACCESS_DENIED`, `MONGO_NOT_CONFIGURED`)
- HTTP method dispatch inside handlers: explicit `if (req.method === 'POST')` / `'DELETE'` blocks, falling through to `405` for unsupported methods
- `sonner` toast for user-facing error surfacing — `toast.error('Não foi possível atualizar os favoritos. Tente novamente.')` in mutation `onError` (React Query)
- React Query mutations use `onMutate` (optimistic update) / `onError` (rollback/toast) / `onSettled` (invalidate queries) — see `src/features/library/hooks/useFavorites.ts`
- `src/components/ui/AppErrorBoundary.tsx` — top-level React error boundary component
## Logging
- Emits structured JSON (`{ timestamp, level, message, ...meta }`) via `console.log`/`console.warn`/`console.error`
- Prefer `logger.info/warn/error(message, meta)` over raw `console.*` in server code. Direct `console.*` calls still exist in ~19 places across `server/` and `src/` — treat these as debt, not the target pattern (see CONCERNS.md if generated).
## Comments
- Sparse; code favors self-explanatory naming over comments
- Short JSDoc-style block comments used above exported hooks/functions to explain a non-obvious business rule, in Portuguese — e.g. in `useFavorites.ts`:
- No enforced JSDoc/TSDoc coverage requirement; types + descriptive names carry most of the documentation burden
## Function Design
## Module Design
## Domain/Architecture-Specific Conventions
- **Tenancy is pervasive**: almost every server-side data access function takes/threads a `tenantId`, `ctx: DocumentRequestContext`, or `TenantStorageContext`, and filters Mongo queries with `tenantScopeFilterFromContext(storage)`. New server code touching documents must accept and apply tenant scope — do not query `documents` collections without it.
- **Access control checks precede mutation**: read-then-authorize-then-write pattern — load the document, call `canUserListDocumentWithShare(...)` (or similar), throw `ServiceError` with `403`/`404` before performing the write.
- **Soft delete via `deletedAt`**: query filters consistently use `{ deletedAt: { $exists: false } }` / `{ deletedAt: null }` alternation rather than a boolean flag; new collections should follow the same soft-delete filter shape.
- **Audit/tracking side effects**: mutating API handlers call `emitTrackingEvent(auditCtx, { action, description, ...metadata }, req)` after a successful write, using `sanitizeAuditMetadata(...)` to scrub metadata before persisting — follow this pattern for any new state-changing endpoint.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## System Overview
```text
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
- File-based routing convention borrowed from Vercel (`api/<path>.ts` = `/api/<path>`), but actually executed by a hand-rolled dispatcher (`server/apiServer.ts`) for both dev and single-process production — no actual Vercel platform dependency at runtime.
- Multi-tenant data isolation via **per-tenant MongoDB collection name prefixes** (business tenants: `documents_{tenantId}`; individual/PF tenants: shared pool collections filtered by `ownerUserId`) rather than a shared collection with a tenant column.
- Auth/identity fully delegated to a sibling service; the Alpha app never talks to Postgres directly, only to `doqyn-auth-service` over HTTP with a shared internal API key, plus a Redis-backed session cache to avoid re-verifying on every request.
- Long-running AI/OCR/preview work is offloaded to BullMQ workers backed by Redis, with an in-process worker fallback (`ANALYSIS_WORKER_IN_PROCESS`) for simpler deployments/dev.
- Frontend organized by **feature module** (`src/features/<domain>`), each owning its own `api/`, `components/`, `hooks/`, `utils/` — not by technical layer.
## Layers
- Purpose: HTTP entrypoints; parse request, enforce auth/tenant context, delegate to a service, shape the JSON/binary response.
- Location: `api/**/*.ts`
- Contains: One handler per endpoint (e.g. `api/documents/upload.ts`, `api/signature-requests/[signatureRequestId]/sign.ts`), exporting `default async function handler(req, res)` typed with `@vercel/node`.
- Depends on: `server/auth/*`, `server/tenancy/*`, `server/services/*`, `server/utils/serviceErrors.ts`.
- Used by: `server/apiServer.ts` route table (dev/production dispatcher) and, if deployed on Vercel, the platform's own file-based router.
- Purpose: Encapsulate domain logic (document lifecycle, sharing, signatures, audit, tenants, dashboard aggregation).
- Location: `server/services/*.ts` (plus subfolders `server/services/analysis`, `server/services/confirm`, `server/services/favorites`, `server/services/preview`, `server/services/profile`, `server/services/sharing`, `server/services/signatures`, `server/services/tracking`, `server/services/trash`)
- Contains: Functions taking plain data + tenant/user context, returning results or throwing `ServiceError`.
- Depends on: `server/tenancy/getTenantCollections.ts` (Mongo collection access), `server/storage/*`, `server/ai/*`, `server/db/types.ts`.
- Used by: `api/**` handlers, workers.
- Purpose: Resolve which tenant a request belongs to, compute tenant-prefixed Mongo collection names, resolve storage scope (R2 bucket/prefix or local path), enforce quotas.
- Location: `server/tenancy/*.ts`
- Contains: `getTenantCollections.ts`, `tenantResolver.ts` (implied), `documentRequestContext.ts`, `resolveTenantStorageScope.ts`, `tenantQuotas.ts`, `documentAccess.ts`, `documentOwnership.ts`, `documentShareAccess.ts`.
- Depends on: `server/db/mongoClient.ts`, `server/auth/tenantContext.ts`.
- Used by: virtually every `api/documents/**`, `api/company-members/**`, `api/governance/**` handler.
- Purpose: Verify session (doqyn_auth cookie via sibling service, or legacy `temporary` JWT), map to `AuthUser`, enforce role/group checks.
- Location: `server/auth/*.ts`, `server/auth/providers/doqynAuthProvider.ts`
- Contains: `requireAuth.ts` (entry guard used by handlers), `sessionCache.ts` (Redis cache of verified sessions), `authConfig.ts` (provider switch), `permissions.ts`.
- Depends on: `doqyn-auth-service` HTTP API (`/internal/sessions/verify`), Redis, `server/utils/serviceErrors.ts`.
- Used by: `server/tenancy/documentRequestContext.ts` and directly by handlers needing plain auth (e.g. `api/me.ts`).
- Purpose: Turn an uploaded PDF/image into extracted text, a document classification, and structured metadata.
- Location: `server/ai/services/*.ts`, `server/ai/providers/*.ts`, `server/ai/vision/*.ts`, `server/ai/utils/*.ts`
- Contains: `analyzePdfService.ts` / `analyzePdfUpdateService.ts` (orchestrators), `documentTextExtractor.ts`/`pdfTextExtractor.ts`, `documentClassifierAgent.ts`, `metadataExtractorAgent.ts`, Groq client (`groqClient.ts`), Google Vision OCR fallback (`visionOcrService.ts`).
- Depends on: Groq SDK, `@google-cloud/vision`, `pdf-parse`/`pdfjs-dist`.
- Used by: `api/ai/analyze-pdf.ts`, `server/workers/analysisWorker.ts`.
- Purpose: Run PDF analysis and preview/thumbnail generation asynchronously, with per-tenant concurrency limits.
- Location: `server/queues/analysisQueue.ts`, `server/queues/analysisTenantConcurrency.ts`, `server/queues/previewQueue.ts`, `server/workers/analysisWorker.ts`, `server/workers/previewWorker.ts`, `server/workers/runAnalysisWorker.ts` (standalone process entry), `server/workers/runPreviewWorker.ts`
- Contains: BullMQ job producers/consumers backed by `ioredis`.
- Depends on: Redis (`server/redis/redisClient.ts`), `server/ai/services/*`, `server/storage/*` (staging buffer retrieval), `server/services/analysis/analysisJobService.ts`.
- Used by: `api/documents/upload.ts` / `api/ai/analyze-pdf.ts` (enqueue), standalone `npm run dev:worker` / `start:worker` processes, or in-process fallback started from `server/apiServer.ts`.
- Purpose: Present one interface for "put/get/delete/presign a file" regardless of backend.
- Location: `server/storage/storageProvider.ts` (interface), `server/storage/getStorageProvider.ts` (factory), `server/storage/r2/*.ts` (Cloudflare R2 / S3 implementation), `server/storage/localStorageProvider.ts` (disk fallback for dev)
- Depends on: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`.
- Used by: `server/services/documentService.ts`, `server/services/documentFileService.ts`, analysis workers (staging objects).
- Purpose: Own the single MongoDB connection, canonical database name resolution, index bootstrap, and shared Mongo document types.
- Location: `server/db/mongoClient.ts`, `server/db/database.ts` (DB name), `server/db/constants.ts` (legacy flat collection names — see Anti-Patterns), `server/db/types.ts`, `server/db/tenantIndexes.ts` + per-feature index files.
- Used by: `server/tenancy/getTenantCollections.ts` and, indirectly, all services.
- Purpose: Compose providers (React Query, auth), define the router, lazy-load route-level feature entry points.
- Location: `src/app/App.tsx`, `src/app/providers.tsx`, `src/app/routes.tsx`, `src/app/lazyRoutes.tsx`, `src/app/queryClient.ts`, `src/app/layout/WorkspaceLayout.tsx`
- Depends on: `src/features/auth/ProtectedRoute.tsx`, `src/components/layout/AppLayout.tsx`.
- Purpose: One folder per business domain (documents, upload, library, signature, governance/rules, sharing, tracking, audit, dashboard, settings, users, profile, onboarding flows). Each is internally layered: `api/` (fetch wrappers), `components/`, `hooks/`, `utils/`, `types.ts`.
- Location: `src/features/<domain>/**`
- Depends on: `src/lib/api.ts` (fetch wrapper), `@tanstack/react-query`, `src/auth/*`.
- Used by: `src/app/lazyRoutes.tsx` (route-level code splitting per feature).
- Purpose: Client-side session handling for the `doqyn_auth` cookie-based provider — fetch `/api/me`, cache/normalize session shape, expose `useAuth()`.
- Location: `src/auth/AuthProvider.tsx`, `src/auth/useAuth.ts`, `src/auth/sessionApi.ts`, `src/auth/authServiceClient.ts`, `src/auth/mapMeSession.ts`
- Note: distinct from `src/features/auth/*`, which wraps `src/auth` behind a pluggable `auth-provider` abstraction (`temporary` vs `doqyn_auth`) used by `ProtectedRoute`/`PublicRoute`.
## Data Flow
### Primary Request Path (document upload → AI analysis → persistence)
### Authentication Flow
- Server: stateless per-request; all persistent state lives in MongoDB (documents/metadata), Cloudflare R2/local disk (binaries), Redis (BullMQ job queues + session cache + rate limits), and PostgreSQL inside `doqyn-auth-service` (identity/tenancy/memberships).
- Client: TanStack React Query owns all server-derived state (`src/app/queryClient.ts`); Zustand is a declared dependency (`package.json`) but no `src/stores/*` files currently use it — local/ephemeral UI state is otherwise handled with component state, contexts (`src/contexts/*`), and feature-local hooks (e.g. `src/features/upload/queue/useUploadQueue.ts`).
## Key Abstractions
- Purpose: Uniform way for any service function to signal a business-rule failure with an HTTP status code and machine-readable `code`.
- Examples: `server/utils/serviceErrors.ts` (definition), used throughout `server/services/*.ts` and `server/tenancy/*.ts`.
- Pattern: `throw new ServiceError(message, code, statusCode)`; handlers catch with `isServiceError(error)` and map directly to `res.status(error.statusCode).json({ message, code })` — see `api/documents/upload.ts`.
- Purpose: Single object threaded through document-related handlers/services carrying `tenantId`, `userId`, `membershipId`, resolved `storageScope`, and a `TenantCollections` handle.
- Examples: `server/tenancy/documentRequestContext.ts` (`requireDocumentRequestContext`, `buildDocumentRequestContext`).
- Pattern: Handlers call `const ctx = await requireDocumentRequestContext(req, res); if (!ctx) return;` at the top, then pass `ctx` into service calls instead of re-deriving tenant/user info.
- Purpose: Resolve tenant-scoped, name-prefixed MongoDB collection handles once per request instead of hardcoding collection names.
- Examples: `server/tenancy/getTenantCollections.ts`, collection name resolution in `server/tenancy/tenantResolver.ts` (referenced), naming rules in `docs/MONGODB_TENANT_ISOLATION.md` / `docs/TENANT_STORAGE_MODEL.md`.
- Pattern: `const collections = await getTenantCollections(tenantId, {...}); collections.documents.find(...)` — never `db.collection('documents')` directly in service code.
- Purpose: Abstract over Cloudflare R2 (S3-compatible) vs local disk so services don't branch on environment.
- Examples: `server/storage/storageProvider.ts` (interface), `server/storage/r2/r2StorageProvider.ts`, `server/storage/localStorageProvider.ts`, factory in `server/storage/getStorageProvider.ts`.
- Pattern: Services call `getStorageProvider()` and use the returned object's `put`/`get`/`delete`/presign methods; environment (`STORAGE_PROVIDER` / R2 credentials presence) decides implementation at runtime.
- Purpose: Keep API code deployable both as literal Vercel serverless functions and as routes dispatched by the hand-rolled Node server.
- Examples: every file under `api/**/*.ts`; route table in `server/apiServer.ts`.
- Pattern: `export default async function handler(req: VercelRequest, res: VercelResponse) { ... }`; dynamic path segments follow Next.js/Vercel bracket convention (`api/documents/[documentId]/shares.ts`) and are manually re-mapped to regex routes in `server/apiServer.ts` for local/VPS execution.
- Purpose: Co-locate everything needed for one business capability so it can be lazy-loaded and reasoned about independently.
- Examples: `src/features/documents/*`, `src/features/upload/*`, `src/features/signature/*`, `src/features/rules/*` (governance flow with `@xyflow/react`).
- Pattern: `src/features/<name>/api/*Api.ts` (fetch wrappers over `src/lib/api.ts`), `hooks/use*.ts` (React Query hooks), `components/*.tsx`, optional `utils/`, `types.ts`; entry route component re-exported and lazy-loaded from `src/app/lazyRoutes.tsx`.
## Entry Points
- Location: `src/main.tsx` → `src/app/App.tsx` → `src/app/providers.tsx` + `src/app/routes.tsx`
- Triggers: browser load of the Vite-built SPA.
- Responsibilities: mount React root, wrap in `StrictMode`, install React Query + auth providers, hand off to `react-router-dom`'s `RouterProvider`.
- Location: `server/dev-server.ts` (dev, `npm run dev:api`) and `server/production-server.ts` (prod, `npm run start:api`), both thin wrappers around `server/apiServer.ts` (`startApiServer`).
- Triggers: `npm run dev` (concurrently runs Vite + this) or `node dist/server/production-server.js` in Docker/VPS.
- Responsibilities: init Prometheus metrics, connect Redis, optionally start in-process analysis worker, start plain Node `http.createServer` with manual route resolution mirroring `api/**` file structure, expose GeoIP lookups for tracking.
- Location: each `api/**/*.ts` file individually, per Vercel's file-based routing convention (implied by `@vercel/node` devDependency and Vercel-shaped handler signatures; primary deployment per `docs/DEPLOY_VPS.md` is Docker/VPS via `server/production-server.ts`, not Vercel).
- Location: `server/workers/runAnalysisWorker.ts` (`npm run dev:worker` / `start:worker`), `server/workers/runPreviewWorker.ts` (`npm run dev:worker:preview` / `start:worker:preview`)
- Triggers: run as separate long-lived processes (e.g. separate Docker service) when analysis is not run in-process.
- Responsibilities: consume BullMQ jobs from Redis, execute the same worker logic as the in-process fallback (`server/workers/analysisWorker.ts` / `previewWorker.ts`).
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
### Hardcoding a new `api/` route without updating the dispatcher
### Mixing `AUTH_PROVIDER=temporary` assumptions into new code
## Error Handling
- Service layer: `throw new ServiceError('Sessão inválida.', 'INVALID_SESSION', 401)` — never return `null`/ad-hoc error objects for expected failure modes.
- API handler layer: `try { ... } catch (error) { if (isServiceError(error)) return res.status(error.statusCode).json({ message: error.message, code: error.code }); return res.status(500).json({ message: ... }); }` — see `api/documents/upload.ts`, `server/auth/requireAuth.ts`.
- Worker layer: BullMQ's `DelayedError` is used intentionally to requeue jobs (e.g. tenant concurrency slot not available in `server/workers/analysisWorker.ts`) and is explicitly re-thrown rather than treated as a failure; all other errors are logged via `pipelineError`/`logger.error` and recorded in Prometheus (`recordAnalysisJobCompletion`) before propagating to BullMQ's retry mechanism.
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
