# External Integrations

**Analysis Date:** 2026-07-15

## APIs & External Services

**AI / Document Analysis:**
- Groq (LLM API) - primary document classification and metadata extraction engine
  - SDK/Client: `groq-sdk`, wrapped in `server/ai/services/groqClient.ts`
  - Provider abstraction: `server/ai/providers/groqDocumentAnalysisProvider.ts` (implements `DocumentAnalysisProvider` from `server/ai/providers/types.ts`), selected via `server/ai/providers/resolveAnalysisProvider.ts` and `DOCUMENT_ANALYSIS_PROVIDER=groq`
  - Model: `GROQ_MODEL` (default `meta-llama/llama-4-scout-17b-16e-instruct`), optional per-stage overrides `GROQ_CLASSIFIER_MODEL` / `GROQ_EXTRACTOR_MODEL`
  - Auth: `GROQ_API_KEY` (server-only, never `VITE_`-prefixed)
  - Timeout/limits: `GROQ_REQUEST_TIMEOUT_MS`, `GROQ_MAX_OUTPUT_TOKENS`, `PDF_ANALYSIS_MAX_INPUT_CHARS`, `PDF_ANALYSIS_MAX_PAGES`
  - Smoke tests: `scripts/test-groq-smoke.mjs`, `scripts/test-groq-fixture.mjs`, `scripts/test-groq-pdf.mjs` (`npm run test:groq:*`)

- Google Cloud Vision (OCR) - optional OCR pass for scanned PDFs/images when text extraction yields too little text
  - SDK/Client: `@google-cloud/vision`, wrapped in `server/ai/vision/visionOcrService.ts`
  - Config: `server/ai/vision/visionConfig.ts` — enabled via `VISION_OCR_ENABLED` (default `false`)
  - Auth: `GOOGLE_APPLICATION_CREDENTIALS` pointing to a service-account JSON, expected at `deploy/secrets/gcp-vision-sa.json` (gitignored, mounted read-only into containers at `/run/secrets` in `deploy/docker-compose.production.yml`)
  - Note: there is a second, unrelated "google_vision" `DocumentAnalysisProvider` stub (`server/ai/providers/googleVisionDocumentAnalysisProvider.ts`) that always throws `AI_PROVIDER_NOT_ENABLED` — it is NOT the OCR integration above; it is a placeholder for a future full Vision-based classification provider and is explicitly guarded against selection in `assertGoogleVisionNotSelected()`

## Data Storage

**Databases:**
- MongoDB (primary datastore for this repo) - documents, users' tenant data, audit logs, signatures, sharing, governance rules, etc.
  - Client: `mongodb` driver, `server/db/mongoClient.ts` / `server/db/mongoConfig.ts` / `server/db/database.ts`
  - Connection: `MONGODB_URI`, `MONGODB_DATABASE` (default `doqyn_dev`), `MONGODB_TENANT_ID`, `MONGODB_COMPANY_ID`
  - Supports both MongoDB Atlas (`mongodb+srv://`, auto-detected or forced via `MONGODB_USE_ATLAS`) and a local Docker Mongo container (`mongo:7`, Compose profile `local-mongo`)
  - Pool config: `MONGODB_MAX_POOL_SIZE` (50), `MONGODB_MIN_POOL_SIZE` (5), `MONGODB_SERVER_SELECTION_TIMEOUT_MS`
  - Setup/maintenance scripts: `server/db/setupMongo.ts` (`npm run db:setup`), plus a large family of migration/audit scripts in `scripts/` (index creation, tenant-prefix migration, legacy cleanup, isolation testing — see `package.json` `db:*`/`audit:*`/`mongo:*` scripts)
  - Tenant data isolation is enforced at the collection-naming/query level (tenant-prefixed collections); see `scripts/assert-no-flat-tenant-writes.ts` and `scripts/migrate-flat-to-tenant-prefixed.ts`

- PostgreSQL (owned by the sibling `doqyn-auth-service` repo, not this one) - stores all identity/auth data (users, credentials, sessions, tenants, memberships, invites, audit logs) via Prisma. This repo has no direct DB connection to Postgres; all identity data is accessed exclusively through the auth-service HTTP API (see below).

**File Storage:**
- Cloudflare R2 (S3-compatible object storage) - production document storage
  - Client: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, `server/storage/r2/r2Clients.ts`, `server/storage/r2/r2StorageProvider.ts`, `server/storage/r2/r2PresignedUrls.ts`, `server/storage/r2/r2BucketProvisioner.ts`, `server/storage/r2/r2BucketNaming.ts`
  - Selected via `STORAGE_PROVIDER=r2` (alternative: `local` — disk storage, dev/legacy only, `LOCAL_STORAGE_ROOT`)
  - Bucket strategy: per-tenant buckets (`R2_BUCKET_MODE=per_tenant`, `R2_BUCKET_PREFIX`), or a single default bucket (`R2_DEFAULT_BUCKET`)
  - Auth: `R2_ACCOUNT_ID`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` (runtime), `R2_ADMIN_ACCESS_KEY_ID` / `R2_ADMIN_SECRET_ACCESS_KEY` and `CLOUDFLARE_R2_ADMIN_API_TOKEN` (bucket provisioning/admin operations)
  - Presigned direct-upload flow (browser → R2): `PRESIGNED_UPLOAD_ENABLED`, `PRESIGNED_UPLOAD_TTL_SECONDS`, `VITE_PRESIGNED_UPLOAD_ENABLED`
  - Audit/ops scripts: `scripts/r2-env-check.mjs`, `scripts/r2-smoke-test.ts`, `scripts/r2-audit-buckets.ts`, `scripts/r2-cleanup-empty-demo-buckets.ts`

**Caching / Queues:**
- Redis - used for three purposes: BullMQ job queues, auth session cache, and per-tenant rate/usage quotas
  - Client: `ioredis`, `server/redis/redisClient.ts` / `server/redis/redisConfig.ts`
  - Enabled via `REDIS_ENABLED` (defaults to `false` in dev; forced `true` in production Compose)
  - Key isolation: `REDIS_KEY_PREFIX=doqyn:alpha:` in this service vs. `doqyn:auth:` in the auth service (shared Redis instance in production, `deploy/docker-compose.production.yml`)
  - Queues (BullMQ): `server/queues/analysisQueue.ts` (async document analysis, worker `server/workers/runAnalysisWorker.ts`), `server/queues/previewQueue.ts` (async PDF preview via Ghostscript, worker `server/workers/runPreviewWorker.ts`); both have sync-fallback flags (`ANALYSIS_SYNC_FALLBACK`, `PREVIEW_SYNC_FALLBACK`) for environments without Redis
  - Session cache: `server/auth/sessionCache.ts`, `SESSION_CACHE_ENABLED`, `SESSION_CACHE_TTL_SECONDS`
  - Tenant quotas: `TENANT_QUOTA_ENABLED`, `TENANT_QUOTA_ANALYSIS_PER_DAY`, `TENANT_QUOTA_UPLOADS_PER_HOUR` (fail-open without Redis)

## Authentication & Identity

**Auth Provider:**
- `doqyn-auth-service` - a separate, sibling Node/Fastify microservice (`/home/a1rm4x/Documents/GitHub/doqyn-auth-service`) that owns all authentication/identity concerns (login, sessions, invites, membership, roles, OAuth accounts, password reset, email verification) backed by PostgreSQL via Prisma
  - Selected via `AUTH_PROVIDER=doqyn_auth` / `VITE_AUTH_PROVIDER=doqyn_auth` (a legacy local-JWT auth path also exists but is commented out/deprecated in `.env.example`: `TEMP_AUTH_ENABLED`, `JWT_SECRET`, implemented in `server/auth/session.ts` and `server/auth/tempUser.ts`)
  - Provider implementation in this repo: `server/auth/providers/doqynAuthProvider.ts`
  - Communication is HTTP-only, no shared database:
    - Public/browser-facing auth flows are reverse-proxied from this app to the auth service (Vite dev proxy for `/auth` and `/oauth` → `http://127.0.0.1:4100` in `vite.config.ts`; Nginx in production)
    - Server-to-server privileged calls use two dedicated internal clients: `server/integrations/doqynAuthInternalClient.ts` (bearer-token calls to auth-service internal endpoints, e.g. avatar metadata sync) and `server/integrations/doqynAuthAdminClient.ts` (admin/provisioning operations, e.g. tenant/member sync — see `server/integrations/authAccessGroups.ts`, `server/integrations/authTenantMemberTypes.ts`)
    - Auth: `DOQYN_AUTH_INTERNAL_API_KEY` (this app calling auth-service) must exactly match auth-service's `DOQYN_INTERNAL_API_KEY`; `DOQYN_APP_INTERNAL_API_KEY` (auth-service calling back into this app) must match on both sides — enforced by `server/auth/requireAppInternalApiKey.ts` on the receiving side
    - Session cookie: `DOQYN_AUTH_COOKIE_NAME` (default `doqyn_session`), must match auth-service's `SESSION_COOKIE_NAME`
    - Base URLs: `DOQYN_AUTH_BASE_URL` (this app → auth service, e.g. `http://127.0.0.1:4100` dev / `http://auth-api:4100` in Docker), `DOQYN_PUBLIC_APP_URL` (this app's public origin, must be included in auth-service's `ALLOWED_ORIGINS`)
  - Cross-service env parity is checked by `npm run env:auth-sync` (`scripts/env-auth-sync-check.mjs`, documented in `docs/ENV_SYNC.md`)

**Session handling in this repo:**
- `server/auth/session.ts` - JWT session token creation/verification via `jose` (used by legacy/local auth path and internally for signed tokens)
- `server/auth/companyContext.ts`, `server/auth/tenantContext.ts`, `server/auth/memberAuth.ts`, `server/auth/permissions.ts` - tenant/company scoping and permission checks layered on top of the resolved auth identity
- `server/auth/legacyAuthGuard.ts` - guards preventing accidental use of the deprecated local-JWT path when `AUTH_PROVIDER=doqyn_auth`

## Monitoring & Observability

**Metrics:**
- Prometheus - `prom-client` (`server/metrics/prometheus.ts`), default Node process metrics via `collectDefaultMetrics` plus custom counters/histograms (e.g. AI provider request timing)
  - Enabled via `METRICS_ENABLED`; scraped at `/api/metrics` (API) or dedicated port (`METRICS_PORT=9100` on workers)
  - `METRICS_TOKEN` protects the metrics endpoint
  - Production Compose includes optional `--profile observability` stack: `prometheus` (`deploy/observability/`), `grafana` (dashboards/provisioning under `deploy/observability/grafana/`), `redis-exporter`

**Error Tracking:**
- No dedicated error-tracking SaaS (e.g. Sentry) detected — errors are handled via custom `ServiceError` types (`server/utils/serviceErrors.ts`) and structured logging

**Logs:**
- Custom logger: `server/utils/logger.ts`, plus AI-pipeline-specific debug helpers (`server/ai/utils/pipelineDebug.ts`, gated by `AI_PIPELINE_DEBUG`)
- Audit logging is a first-class domain concept (separate from app logs): `server/audit/`, with sanitization tooling (`scripts/sanitize-existing-audit-logs.ts`)

**Security / Tracking:**
- IP-based tracking/audit uses application-level encryption, not a third-party service: `TRACKING_IP_ENCRYPTION_KEY`, `TRACKING_IP_HASH_SALT` (`server/services/tracking/`)
- GeoIP resolution is fully offline: `geoip-lite` / `geolite2-redist` / `maxmind`, auto-downloads the GeoLite2-City DB on first run (`npm run geoip:preload`), optional custom `GEOIP_CITY_DB_PATH`

## CI/CD & Deployment

**Hosting:**
- Primary: self-managed Docker Compose stack on a VPS (`deploy/docker-compose.production.yml`, `deploy/scripts/setup-production-env.sh`, `deploy/scripts/deploy-production.sh`), reverse-proxied by Nginx (`docker/Dockerfile.nginx`, `deploy/nginx/`)
- Alternative: Vercel (`vercel.json` present with rewrites for OG-image bot detection and SPA fallback; `@vercel/node` types used by `api/**` handlers) — used for the frontend + serverless API path as an alternative to the VPS deployment
- The production stack builds the sibling `doqyn-auth-service` repo directly from a relative path (`AUTH_SERVICE_DIR=../../doqyn-auth-service`), so both repos must be checked out side-by-side for a full production build

**CI Pipeline:**
- No CI config files (e.g. `.github/workflows/`) detected in this repo — deployment appears to be manual/scripted via `deploy/scripts/*.sh`

## Environment Configuration

**Required env vars (non-exhaustive, see `.env.example` for full/authoritative list):**
- Auth sync: `AUTH_PROVIDER`, `DOQYN_AUTH_BASE_URL`, `DOQYN_AUTH_INTERNAL_API_KEY`, `DOQYN_AUTH_COOKIE_NAME`, `DOQYN_APP_INTERNAL_API_KEY`, `DOQYN_PUBLIC_APP_URL`
- Database: `MONGODB_URI`, `MONGODB_DATABASE`, `MONGODB_TENANT_ID`, `MONGODB_COMPANY_ID`
- AI: `GROQ_API_KEY`, `GROQ_MODEL`, `DOCUMENT_ANALYSIS_PROVIDER`
- OCR: `VISION_OCR_ENABLED`, `GOOGLE_APPLICATION_CREDENTIALS`
- Storage: `STORAGE_PROVIDER`, `R2_ACCOUNT_ID`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
- Queues/cache: `REDIS_ENABLED`, `REDIS_URL`, `REDIS_KEY_PREFIX`
- Security: `TRACKING_IP_ENCRYPTION_KEY`, `TRACKING_IP_HASH_SALT`

**Secrets location:**
- Local dev: `.env` (gitignored, present locally — contents not read/quoted here per policy)
- Production: `deploy/env/` templates and `deploy/secrets/` (gitignored; holds `gcp-vision-sa.json` and other production secrets, mounted read-only into containers)
- `.env.example` is the canonical, committed reference for all variable names (secrets themselves are blank/placeholder)

## Webhooks & Callbacks

**Incoming:**
- No classic third-party webhook receivers detected (no Stripe/GitHub/etc. webhook handlers). The closest analog is the internal service-to-service callback surface: auth-service calls back into this app's `api/internal/tenants` and `api/internal/tenant-members` endpoints (protected by `DOQYN_APP_INTERNAL_API_KEY` via `server/auth/requireAppInternalApiKey.ts`) for tenant/member provisioning sync.

**Outgoing:**
- This app calls into `doqyn-auth-service`'s internal API (`doqynAuthInternalClient.ts`, `doqynAuthAdminClient.ts`) for admin/provisioning and profile-avatar metadata sync operations.
- Signature/verification and external-share flows generate outward-facing links/QR codes (`server/services/signatures/`, `api/verify/`, `api/external-shares/`, `api/sign/`) but these are internal application routes, not third-party webhooks.

---

*Integration audit: 2026-07-15*
