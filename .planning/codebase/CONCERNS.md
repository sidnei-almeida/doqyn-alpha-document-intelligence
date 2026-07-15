# Codebase Concerns

**Analysis Date:** 2026-07-15

## Tech Debt

**Legacy "temporary" auth backdoor still wired into production routes:**
- Issue: `AUTH_PROVIDER` defaults to `'temporary'` when unset (`server/auth/authConfig.ts:3-7`, `getAuthProvider()`), which activates a single hardcoded admin login flow (`api/auth/login.ts`) backed by `TEMP_ADMIN_EMAIL` / `TEMP_ADMIN_PASSWORD_HASH` env vars and `server/auth/tempUser.ts`. `isTemporaryAuthEnabled()` also defaults to **enabled** unless `TEMP_AUTH_ENABLED=false` is explicitly set.
- Files: `server/auth/authConfig.ts`, `server/auth/tempUser.ts`, `api/auth/login.ts`, `server/auth/requireAuth.ts`
- Impact: Fails open, not closed. If a deploy target forgets to set `AUTH_PROVIDER=doqyn_auth` (it is set correctly today in `.env.example` and `deploy/scripts/setup-production-env.sh`), the app silently falls back to legacy single-admin auth rather than refusing to start. `TEMP_ADMIN_PASSWORD_HASH`/`TEMP_ADMIN_EMAIL` are no longer documented in `.env.example`, meaning the code path is undocumented but still reachable.
- Fix approach: Make `AUTH_PROVIDER` required (throw on boot if unset) instead of defaulting to `temporary`, or remove `api/auth/login.ts` and `server/auth/tempUser.ts` entirely now that `doqyn-auth-service` is the canonical provider.

**Dead client-side AI mock left in the send/upload flow:**
- Issue: `src/features/document-send/services/processDocumentWithAI.ts` implements a fake, filename-keyword-based "AI" classifier (`if (lower.includes('contrato'))...`) with a `TODO: substituir por integração real com análise documental`. It is not imported anywhere in `src/` or `server/` (confirmed via repo-wide grep) — it is orphaned/dead code left over from an early prototype, now superseded by the real server-side pipeline (`server/ai/services/analyzePdfService.ts`, Groq/Vision providers).
- Files: `src/features/document-send/services/processDocumentWithAI.ts`
- Impact: Confuses future contributors about which analysis path is "real"; risk of being accidentally re-wired into the UI instead of the real pipeline.
- Fix approach: Delete the file, or clearly mark it `*.stories`/`*.fixture` and move under a test-fixtures directory if still needed for demos.

**MongoDB tenant isolation enforced only by naming convention + a custom static-analysis script:**
- Issue: Multi-tenant data isolation relies on collection-name prefixing (`documents_<collectionPrefix>`, etc.) rather than a native scoping mechanism (e.g., a `tenantId` field enforced by DB-level access control). A dedicated guard script, `scripts/assert-no-flat-tenant-writes.ts`, greps source for direct writes to un-prefixed ("flat") collections and must be run manually/in CI to catch regressions. See `docs/MONGODB_TENANT_ISOLATION.md` for the full policy.
- Files: `scripts/assert-no-flat-tenant-writes.ts`, `docs/MONGODB_TENANT_ISOLATION.md`, `server/tenancy/`
- Impact: Any new server/API code that calls `db.collection('documents').find(...)` directly (bypassing `getTenantCollections(tenantId)`) silently reads/writes cross-tenant data unless the guard script is remembered and run. This is a static text-pattern check, not a runtime/DB-level constraint — it can be bypassed by any pattern the regex doesn't anticipate (e.g., dynamic collection name construction).
- Fix approach: Wire `npm run audit:no-flat-writes` into CI/pre-commit; consider adding a runtime assertion (`assertTenantScopedCollectionAccess`) on every Mongo call path, not just at write sites flagged by the linter.

**Legacy "flat" / dual-write collections still present (`companies`, `company_members`):**
- Issue: `docs/MONGODB_TENANT_ISOLATION.md` documents `companies` and `company_members` as "Legado — espelho durante migração" / "dual-write/read com `tenant_members`", alongside numerous one-off migration scripts (`scripts/migrate-flat-to-tenant-prefixed.ts`, `scripts/migrate-keycloak-to-auth-user-id.ts`, `scripts/drop-empty-legacy-collections.ts`, `scripts/sanitize-existing-audit-logs.ts`, `scripts/fix-dev-document-version-storage.ts`).
- Files: `docs/MONGODB_TENANT_ISOLATION.md`, `scripts/migrate-flat-to-tenant-prefixed.ts`, `scripts/migrate-keycloak-to-auth-user-id.ts`
- Impact: Ongoing risk of dual-write drift between legacy and canonical collections; every new feature touching tenant membership must remember both paths exist until cleanup scripts fully retire the legacy shape.
- Fix approach: Track remaining legacy-collection reads/writes to zero, then run `scripts/drop-empty-legacy-collections.ts` and remove the dual-write code paths and this doc section.

**`keycloakUserId` → `authUserId` migration is only partially cleaned up:**
- Issue: `server/services/tenantMemberSyncService.ts:119` still explicitly `$unset: { keycloakUserId: '' }` on every upsert, i.e. old documents are cleaned lazily on write rather than via a completed backfill. Recent commit `c5db4eb feat: migrar keycloakUserId → authUserId como campo canônico` shows this is an active/incomplete migration.
- Files: `server/services/tenantMemberSyncService.ts`, `scripts/migrate-keycloak-to-auth-user-id.ts`
- Impact: Code and data model still carry Keycloak-era vocabulary/fields long after Keycloak was removed (`a36df49 IMplemented R2 and removed Keycloak from the dependencies`), increasing cognitive load for new contributors and leaving latent fields in old documents.
- Fix approach: Run the migration script against all environments, confirm zero `keycloakUserId` fields remain, then delete the `$unset` compatibility shim and the migration script.

**Large, monolithic files with high change-churn risk:**
- Files (by line count): `src/features/document-send/hooks/useBulkUploadQueue.ts` (1459 lines, 47 hooks calls), `server/services/signatures/documentSignatureService.ts` (1305 lines), `src/features/document-send/DocumentSendPage.tsx` (1238 lines), `server/db/types.ts` (943 lines), `src/features/rules/components/governance/GovernanceMapCanvas.tsx` (904 lines), `src/features/library/LibraryPage.tsx` (849 lines), `server/services/documentService.ts` (734 lines).
- Impact: Single files owning upload-queue state machine, e-signature workflow, and the main document send page/library page — high blast radius for bugs, harder code review, harder unit testing.
- Fix approach: Extract sub-hooks/sub-components (e.g., split `useBulkUploadQueue.ts` into per-concern hooks: queue state, retry logic, progress reporting) before adding new upload features.

## Known Bugs

**`no_ai` mode is not actually independent of MongoDB availability:**
- Symptoms: Documented in `reports/DOQYN_ANALYZE_PDF_SSL_ERROR_AUDIT_2026-07-01.txt` — with `AI_MODE=no_ai` set, an upload+analyze request still hung for ~30s and failed with a MongoDB Atlas TLS/SSL error, because the deterministic "no AI" path still calls `getMongoClassAndRule(...)` (confirmed current at `server/services/confirmAnalysisService.ts:216`) to resolve the document class/rule from Mongo before returning.
- Files: `server/services/confirmAnalysisService.ts` (line ~216, `getMongoClassAndRule` call), `server/db/mongoConfig.ts`
- Trigger: Any MongoDB Atlas connectivity issue (IP not allow-listed, cluster paused, network blip) during an analyze-pdf request, regardless of `AI_MODE`.
- Workaround: `server/db/mongoConfig.ts` now sets `ATLAS_SERVER_SELECTION_MS = 10_000` (down from the driver default ~30s) and is configurable via `MONGODB_SERVER_SELECTION_TIMEOUT_MS`, but there is still no circuit breaker/fallback — a Mongo outage will fail every analyze request, including ones that don't need "real" AI.

## Security Considerations

**No security response headers configured anywhere:**
- Risk: No `Content-Security-Policy`, `Strict-Transport-Security`, or `X-Frame-Options` headers are set in `vercel.json` or anywhere in `server/apiServer.ts` (verified via grep across `server/` and `vercel.json`). The app also serves guest-facing public routes (`/guest/share/:token`, `/guest/sign/:token`, `/share/:token`, `/sign/:token`) that render external content.
- Files: `vercel.json`, `server/apiServer.ts`
- Current mitigation: None found.
- Recommendations: Add `Content-Security-Policy`, `X-Frame-Options: DENY` (or `frame-ancestors`), `Strict-Transport-Security`, and `Referrer-Policy` headers, especially for the public guest/share/sign routes which are the most exposed attack surface (external-facing, token-based auth, embeddable previews).

**In-memory rate-limit fallback breaks under horizontal scaling:**
- Risk: `doqyn-auth-service/src/security/rateLimit.ts` uses Redis when available (`redisIncrWithTtl`) but falls back to a per-process `Map` (`checkLimitMemory`) when Redis is unreachable. Under multi-instance deployment (the codebase explicitly targets "scale horizontal" per commit `a2f870e`), each instance would maintain independent counters, silently multiplying the effective rate limit (e.g., login brute-force limit of 10 attempts becomes `10 × instance count`) whenever Redis is down.
- Files: `doqyn-auth-service/src/security/rateLimit.ts`
- Current mitigation: Redis is the primary path; memory fallback only activates when Redis is unavailable.
- Recommendations: Fail loud (alert/metric) when the rate limiter falls back to memory in production, or treat a Redis outage as a hard dependency failure for auth-sensitive endpoints (login, password reset, OAuth) rather than silently degrading security guarantees.

**Cross-repo env var drift requires a manual script to detect:**
- Risk: `scripts/env-auth-sync-check.mjs` exists specifically because `doqyn-alpha-document-intelligence` and `doqyn-auth-service` (a separate repo/deploy unit) must keep paired env vars in sync (e.g., `AUTH_PROVIDER`/`DOQYN_AUTH_BASE_URL`/`DOQYN_AUTH_INTERNAL_API_KEY` on one side vs. corresponding config on the auth service side) and there is no automated CI gate — `npm run env:auth-sync` must be run manually before deploys.
- Files: `scripts/env-auth-sync-check.mjs`, `docs/ENV_SYNC.md`, `.env.example` (Alpha), `../doqyn-auth-service/.env.example`
- Current mitigation: A documented pre-deploy manual step (`npm run env:auth-sync`).
- Recommendations: Wire this check into CI/CD (`deploy/scripts/deploy-production.sh`) as an automated pre-flight gate rather than relying on a developer remembering to run it.

## Performance Bottlenecks

**Sequential per-member tenant sync (N+1 round trips):**
- Problem: `syncTenantMembersFromAuth()` iterates all members returned from the auth-service and calls `upsertTenantMemberFromAuthSnapshot()` **sequentially inside a `for...of` loop with `await`** (not batched/parallelized). Each call itself does 3 sequential Mongo round trips (`findOne` for email-collision check, `updateOne` upsert, `findOne` to re-read the saved doc).
- Files: `server/services/tenantMemberSyncService.ts` (lines 50-133 `upsertTenantMemberFromAuthSnapshot`, lines 135-156 `syncTenantMembersFromAuth`)
- Cause: No batching/`Promise.all` or bulk `bulkWrite`; sync is invoked on-demand per tenant (gated by a 15s in-memory TTL cache, `lastSyncedAtByTenant`) so cost scales linearly with tenant member count on every cache-miss request.
- Improvement path: Replace the loop with a MongoDB `bulkWrite` of upserts, and only do the extra "existing by email" collision check when necessary (e.g., pre-fetch all existing docs for the tenant once, resolve collisions in memory, then issue a single bulk operation).

**In-memory sync cache (`lastSyncedAtByTenant`) is process-local:**
- Problem: The 15-second TTL cache guarding tenant member sync frequency (`server/services/tenantMemberSyncService.ts:18`) is a plain `Map` in module scope, not shared via Redis.
- Files: `server/services/tenantMemberSyncService.ts`
- Cause: No cross-instance cache; under horizontal scaling each server process independently tracks "last synced" time.
- Improvement path: Move this TTL tracking into Redis (the codebase already has `server/redis/redisClient.ts` primitives used elsewhere, e.g. `server/auth/sessionCache.ts`) for consistent behavior across instances.

## Fragile Areas

**Analysis worker pipeline (Groq/Vision + MongoDB coupling):**
- Files: `server/workers/analysisWorker.ts`, `server/ai/services/analyzePdfService.ts` (615 lines), `server/services/confirmAnalysisService.ts` (677 lines)
- Why fragile: Multiple external dependencies chained per job (R2 storage staging → tenant storage scope resolution → Mongo class/rule lookup → Groq/Vision AI call → BullMQ state transitions with tenant concurrency slots). A failure at any hop (documented for MongoDB Atlas TLS above) surfaces as an opaque worker failure; tenant concurrency slot acquisition (`tryAcquireTenantAnalysisSlot`) uses `DelayedError`/manual requeue logic that is easy to get wrong when modifying retry semantics.
- Safe modification: Any change to `runAnalysisForPayload` or the slot acquisition logic should be tested against both `job_kind = 'initial'` and `'version_update'` paths, and against a simulated Mongo/Redis outage.
- Test coverage: No dedicated worker-level tests found under `tests/` for `analysisWorker.ts`'s slot-acquisition/retry logic (verified: no `tests/**/*analysisWorker*` or `*analysisTenantConcurrency*` files found).

**Frontend has effectively zero automated test coverage:**
- Files: All of `src/` (React components/hooks) — 0 `*.test.ts(x)` files found colocated in `src/`.
- Why fragile: All 149 test files live under `tests/` and are overwhelmingly backend/service-level (Node `tsx --test` runner via `npm test`); files named like `tests/feedback-ui.test.ts` and `tests/document-update-version-ui.test.ts` test business-logic modules, not actual React component rendering/behavior. Large, stateful components/hooks (`useBulkUploadQueue.ts` 1459 lines, `DocumentSendPage.tsx` 1238 lines, `GovernanceMapCanvas.tsx` 904 lines) have no direct test coverage.
- Safe modification: Manual QA in the running app is currently the only verification method for frontend changes to upload flow, library page, and governance map canvas.
- Test coverage: Gap — no component/DOM testing framework (React Testing Library, jsdom-based component tests) appears wired into `npm test` (`tsx --test tests/**/*.test.ts`); confirm before adding frontend logic that isn't manually smoke-tested.

## Scaling Limits

**Serverless (Vercel `api/*`) request handlers vs. long-running AI analysis:**
- Current capacity: The `api/` directory follows Vercel serverless function conventions (`api/documents/[documentId].ts` style routing per `vercel.json` rewrites), while actual document analysis is offloaded to BullMQ workers (`server/workers/analysisWorker.ts`, `server/workers/previewWorker.ts`) that must run as long-lived processes (`npm run start:worker`), separate from the request/response serverless functions.
- Limit: Requires two deployment topologies to be kept in sync (serverless API + always-on worker processes + Redis for BullMQ) — misconfiguring either (e.g., deploying only the Vercel functions without a running worker) will silently queue jobs that never process.
- Scaling path: `server/queues/analysisTenantConcurrency.ts` implements per-tenant concurrency slots to prevent one tenant from starving others; this must be re-verified whenever worker count changes (per `docs/ARCHITECTURE_SCALE.md`).

## Dependencies at Risk

**Duplicate/legacy demo & backup artifacts committed to the repo:**
- Risk: Large binary/demo assets (`NDA - ACORDO DE CONFIDENCIALIDADE (2).pdf`, `dark_logo.png`, `light_logo.png`, `LOGO_IICON.png`) and Mongo backup dumps (`backups/mongo-cleanup-20260625-183538/`, `backups/mongo-cleanup-20260627-155123/`, `backups/mongo-cleanup-20260627-155335/`) live directly in the repo root/`backups/`, not in `.gitignore`-excluded storage.
- Impact: Repo bloat over time; backup dumps in git history may contain production-adjacent data snapshots from cleanup operations.
- Migration plan: Move backups to external storage (R2/S3) referenced by path/manifest instead of committing dump directories; confirm no PII/tenant data is present in the already-committed `backups/mongo-cleanup-*` directories.

## Missing Critical Features

**No CI-enforced tenant-isolation or env-sync gates:**
- Problem: Both the tenant-isolation guard (`scripts/assert-no-flat-tenant-writes.ts`) and the cross-repo env-sync check (`scripts/env-auth-sync-check.mjs`) exist as npm scripts but are not confirmed to run automatically in CI/CD (no `.github/workflows` found in this repo at time of analysis).
- Blocks: Regressions in either area (accidental flat-collection writes, auth/alpha env drift before a production deploy) rely entirely on developer discipline to run `npm run audit:no-flat-writes` / `npm run env:auth-sync` manually.

## Test Coverage Gaps

**Frontend components/hooks (React):**
- What's not tested: `src/features/document-send/hooks/useBulkUploadQueue.ts`, `src/features/document-send/DocumentSendPage.tsx`, `src/features/rules/components/governance/GovernanceMapCanvas.tsx`, `src/features/library/LibraryPage.tsx`, `src/auth/AuthProvider.tsx`.
- Files: entire `src/` tree (0 co-located test files).
- Risk: Regressions in upload queue state machine, e-signature UI flows, or auth context are only caught by manual testing or in production.
- Priority: High — these are the highest-traffic, highest-line-count files in the frontend.

**Worker retry/concurrency logic:**
- What's not tested: Tenant concurrency slot acquisition/release and delayed-job retry behavior in `server/workers/analysisWorker.ts` and `server/queues/analysisTenantConcurrency.ts`.
- Files: `server/workers/analysisWorker.ts`, `server/queues/analysisTenantConcurrency.ts`
- Risk: A regression here could cause jobs to be dropped, stuck in `DelayedError` loops, or bypass per-tenant concurrency limits (noisy-neighbor risk).
- Priority: Medium-High.

---

*Concerns audit: 2026-07-15*
