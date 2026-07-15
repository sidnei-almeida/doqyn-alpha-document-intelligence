# Performance & Security Audit — Scaling to ~4,000 Users on a Hostinger VPS

**Date:** 2026-07-15
**Scope:** `doqyn-alpha-document-intelligence` + sibling `doqyn-auth-service`, evaluated against a 1-year horizon of ~4,000 users on a resource-constrained VPS.
**Method:** Full codebase map (`.planning/codebase/*.md`) + two targeted deep-dive investigations (performance, security) with file:line evidence. Findings below are grounded in actual code, not generic advice.

---

## How to read this document

Each finding uses:
- **Severity**: High / Medium / Low — blast radius and likelihood combined.
- **Issue**: what's actually in the code today.
- **Impact**: what breaks, specifically, as you approach 4,000 users on limited VPS resources.
- **Recommendation**: the concrete fix.
- **Priority**: 1 (do this first) → 5 (backlog).

Findings are grouped Performance first, then Security, then cross-cutting architecture guidance. Within each group, ordered by priority.

---

## PERFORMANCE

### P-1. Zero Docker resource limits on any service
- **Severity:** High
- **Issue:** `deploy/docker-compose.production.yml` has no `deploy.resources.limits`/`reservations` on any of its ~12 services (postgres-auth, mongo, redis, doqyn-api, doqyn-worker, doqyn-worker-preview, auth-api, nginx, etc.). Confirmed via full-file grep — zero matches for `cpus:`/`memory:`.
- **Impact:** On a Hostinger VPS with fixed, modest RAM/CPU, any single component (a large PDF OCR burst, a Mongo query that suddenly does a full collection scan — see P-3, an in-process worker leak) can consume all available memory and trigger the kernel OOM killer against an *arbitrary* container — potentially Postgres or Mongo, not the offending process. At low user counts this never surfaces because load stays inside slack capacity; at 4,000 users the slack disappears and this becomes the top cause of full-stack outages.
- **Recommendation:** Add `deploy.resources.limits.memory`/`cpus` (and sane `reservations`) to every service in `docker-compose.production.yml`, sized against the actual VPS plan (e.g., cap `doqyn-worker`/`doqyn-worker-preview` tightly since they're the most bursty CPU consumers; give Mongo/Postgres/Redis guaranteed reservations since they must never be OOM-killed). Pair with `mem_limit`/`restart: on-failure` so a killed container recovers instead of cascading.
- **Priority:** 1

### P-2. Unbounded, full-collection dashboard queries
- **Severity:** High
- **Issue:** `server/services/dashboardOverviewService.ts:311-315` and `:436-439` run `.find(docQuery).project(...).toArray()` with **no `.limit()`** — every active document (and every document-version row, for the storage-usage widget) in a tenant is pulled into Node memory just to bucket-count status/category/bytes in JS.
- **Impact:** This runs on every dashboard page view. Cost scales linearly with each tenant's total document count, not with what's actually displayed. A tenant with 20,000 documents after a year of use turns a dashboard load into a multi-second, memory-heavy operation — and does so on the same Node process serving everyone else's requests.
- **Recommendation:** Replace with a MongoDB `$facet`/`$group` aggregation pipeline that returns pre-bucketed counts and sums server-side (Mongo already has the compound indexes to support the filter side — see P-3). Node should never receive more than the handful of aggregate numbers the dashboard actually renders.
- **Priority:** 1

### P-3. Missing indexes for sort/search — collection scans on the most-used feature
- **Severity:** High
- **Issue:** `resolveDocumentListSort` (`server/utils/documentListQuery.ts:6-26`) allows sorting the document list by `currentFileName`/`className`, but `tenantIndexes.ts` only indexes `updatedAt`, `status`, `classId`, `ownerUserId` as trailing sort keys — no index backs those two sorts. Worse, `buildDocumentSearchOrClause` (`documentListQuery.ts:29-63`) builds an `$or` of ~15 unanchored `$regex` conditions across title/filename/owner/etc., and **no field in that clause is indexed** — there's no `$text` index anywhere in `tenantIndexes.ts` either.
- **Impact:** Document search/list-sort is almost certainly the single most frequently used feature in the app. Every search keystroke triggers a full collection scan per tenant. This degrades directly and predictably as each tenant accumulates documents — exactly the growth curve you're planning for.
- **Recommendation:** Add a MongoDB `$text` index (or move to a proper search layer if budget allows) covering the searchable fields, and add supporting indexes for the two sortable-but-unindexed fields. Audit `setupMongo.ts` vs `tenantIndexes.ts` — they've drifted (see P-10), so verify which one actually runs in the production index-creation job (`doqyn-api-indexes` service) before assuming these gaps are the whole story.
- **Priority:** 1

### P-4. Sync fallback for AI analysis/preview can silently activate in production
- **Severity:** High
- **Issue:** `isAsyncPdfAnalysisAvailable()` (`server/services/enqueuePdfAnalysisJob.ts:15-17`) gates the async (BullMQ) path on `isAnalysisQueueEnabled() && isStorageConfigured()` — **not solely** on the `ANALYSIS_SYNC_FALLBACK` flag that's explicitly set to `false` in production (`docker-compose.production.yml:154`). If R2/storage becomes transiently unavailable or misconfigured, `api/ai/analyze-pdf.ts:124-201` silently falls through to running `pdf-parse` (CPU-bound) and the Groq/Vision calls **synchronously inside the request handler**, on the single Node event loop. The identical pattern exists for preview generation via `sharp`/Ghostscript (`documentPreviewScheduling.ts:36-43`).
- **Impact:** A transient R2 blip (which will happen — it's a third-party dependency) converts into every concurrent user on that API instance experiencing blocked event-loop latency, not just the tenant whose upload triggered it. This is a hidden availability multiplier: a small, isolated external hiccup becomes a site-wide slowdown.
- **Recommendation:** Decouple the sync-fallback decision from storage availability. In production, if the async path can't be used, the request should fail fast (503, retryable) rather than silently degrade to blocking synchronous processing. Reserve the sync path strictly for local dev.
- **Priority:** 1

### P-5. BullMQ has no true per-tenant queue isolation (noisy-neighbor risk)
- **Severity:** Medium-High
- **Issue:** `analysisTenantConcurrency.ts` enforces a per-tenant cap (default 2) *after* a job is already pulled from the single shared BullMQ queue into one of the global worker's concurrency slots (default 10); on cap violation the job is delayed 5s and retried, but it still competed for a slot to get there. The preview queue (`previewQueue.ts`) has **no per-tenant limiter at all** — one tenant can occupy all 4 global preview slots.
- **Impact:** As you onboard tenants of different sizes, a single tenant doing a bulk upload can measurably slow down every other tenant's document processing and preview generation — the opposite of what multi-tenant fairness is supposed to guarantee, and the kind of complaint that surfaces exactly once you have enough concurrent tenants to collide.
- **Recommendation:** Either partition BullMQ into per-tenant-group queues, or move the concurrency check before dequeue (BullMQ rate-limiter groups / custom scheduling) rather than after. At minimum, add the same per-tenant cap to the preview queue that analysis already has.
- **Priority:** 2

### P-6. Redis has no maxmemory / eviction policy
- **Severity:** Medium
- **Issue:** The production Redis command is `redis-server --save 60 1 --loglevel warning` (`docker-compose.production.yml:126-138`) — no `maxmemory` or `maxmemory-policy` set anywhere in the repo. Default policy is `noeviction`. This single Redis instance backs BullMQ job data, the auth session cache, and tenant quotas simultaneously (confirmed shared singleton client, `server/redis/redisClient.ts`).
- **Impact:** Once Redis hits whatever memory ceiling the host eventually imposes, it starts **rejecting writes outright** rather than evicting old keys — which can simultaneously break session verification (users logged out / re-verified against the auth-service on every request) and stall the BullMQ queues (jobs silently fail to enqueue), with no configured warning threshold.
- **Recommendation:** Set an explicit `maxmemory` sized to the VPS budget. Because job-queue data (must not be evicted) and session-cache data (safe to evict) have very different safety requirements, consider splitting them into separate logical Redis DBs (`SELECT`) or separate instances with different eviction policies (`noeviction` for BullMQ, `allkeys-lru` for session cache/quotas).
- **Priority:** 2

### P-7. Sequential N+1 patterns beyond the already-known tenant-sync case
- **Severity:** Medium
- **Issue:** `governanceMembersService.ts:220-236` makes up to 100 sequential HTTP round-trips to `doqyn-auth-service` (one per member, no `Promise.all`) to hydrate a member list. Batch document move/trash/restore endpoints (`documentMoveService.ts:248-269`, `documentTrashService.ts:493-508`) process one document at a time in a loop.
- **Impact:** These scale linearly with input size and become visibly slow exactly as usage grows (bigger companies with more members, bigger batch operations) — the classic "worked fine in the demo with 5 items" bug.
- **Recommendation:** Batch the auth-service member lookups (bulk endpoint or `Promise.all` with a concurrency cap), and switch batch document operations to `bulkWrite`/parallel-with-concurrency-limit instead of one-at-a-time.
- **Priority:** 2

### P-8. Nginx serves no compression and no cache-control headers
- **Severity:** Medium
- **Issue:** `deploy/nginx/default.conf` has zero `gzip`/`brotli` directives and zero `Cache-Control`/`expires` headers anywhere (confirmed via full-tree grep).
- **Impact:** Every SPA JS/CSS bundle and every API JSON response transfers uncompressed, and hashed static assets are never cached by the browser — meaning every page load re-fetches everything, and each fetch costs 3-5x the bytes it needs to. This directly burns VPS bandwidth (Hostinger plans typically cap this) and CPU, and adds latency to literally every request.
- **Recommendation:** Enable gzip (or brotli) in nginx for text/JSON/JS/CSS, and add long-lived `Cache-Control: immutable` headers for hashed build assets (Vite already content-hashes filenames, so this is a pure win with no staleness risk). This is one config file, high leverage.
- **Priority:** 2

### P-9. Session cache always pays a Redis round-trip
- **Severity:** Low-Medium
- **Issue:** `sessionCache.ts` caches verified sessions in Redis with a 45s TTL, but there's no in-process (per-instance) LRU layer on top — every authenticated request still does a network round-trip to Redis.
- **Impact:** At 4,000 users this is thousands of avoidable Redis calls per minute, adding latency and load to the same Redis instance that's also handling BullMQ and quotas with no eviction policy (compounds P-6).
- **Recommendation:** Add a short-TTL (a few seconds) in-process LRU cache in front of the Redis lookup — cheap to add, meaningfully reduces Redis load and per-request latency without materially weakening session freshness.
- **Priority:** 3

### P-10. Stale, drifted index definitions between two files
- **Severity:** Medium (contingent — needs verification)
- **Issue:** `server/db/setupMongo.ts` and `server/db/tenantIndexes.ts` both define index sets, but `setupMongo.ts`'s `auditLogs` indexes are a reduced subset of what `tenantIndexes.ts` defines. It was not confirmed in this pass which file the production `doqyn-api-indexes` one-shot job actually imports.
- **Impact:** If production index creation runs the stale file, several of the indexes assumed to exist in P-3's analysis simply aren't there in production, silently worsening query performance from day one.
- **Recommendation:** Verify `dist/scripts/ensure-mongodb-indexes.js`'s source imports `tenantIndexes.ts`, delete the drifted duplicate definitions in `setupMongo.ts`, and make index creation the single source of truth.
- **Priority:** 2

---

## SECURITY

### S-1. Legacy "temporary" auth fails open, not closed
- **Severity:** High
- **Issue:** `server/auth/authConfig.ts:3-7` — `getAuthProvider()` returns `'temporary'` for **any** value of `AUTH_PROVIDER` other than exactly `'doqyn_auth'` (including unset). `server/auth/tempUser.ts:39-41` — `isTemporaryAuthEnabled()` defaults to **true** unless `TEMP_AUTH_ENABLED` is the literal string `'false'`. This activates a single hardcoded admin login (`api/auth/login.ts`) backed by an env-supplied bcrypt hash of unknown cost factor.
- **Impact:** A misconfigured or incomplete deploy (missing env var, typo, a new environment spun up without the full `.env`) doesn't refuse to start — it silently exposes a completely different, single-admin authentication path alongside the real one. This is the highest-leverage security finding in the whole audit precisely because it's invisible until someone (attacker or a confused ops script) hits it.
- **Recommendation:** Make `AUTH_PROVIDER` required — throw on boot if unset or not `doqyn_auth` — rather than defaulting to the legacy path. Given `doqyn_auth` is confirmed the canonical provider everywhere else in the code, strongly consider deleting `api/auth/login.ts` and `server/auth/tempUser.ts` entirely instead of just changing the default.
- **Priority:** 1

### S-2. No security response headers anywhere
- **Severity:** High
- **Issue:** Confirmed zero occurrences of `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, or `Referrer-Policy` in `server/apiServer.ts`, any `api/**` handler, or `deploy/nginx/default.conf`. No `helmet`-equivalent package installed.
- **Impact:** The app serves guest-facing public routes (share/sign links) that render externally-linked content with no clickjacking protection (no `X-Frame-Options`/`frame-ancestors`) and no CSP to contain an XSS if one is ever introduced. This is the single highest blast-radius/cheapest-fix mismatch in the whole audit.
- **Recommendation:** Add the headers once, centrally, in `deploy/nginx/default.conf` (the natural chokepoint since nginx already fronts both `doqyn-api` and `auth-api` behind one origin) via `add_header` directives. No app-code changes needed.
- **Priority:** 1

### S-3. No rate limiting on the Alpha API's public/guest endpoints
- **Severity:** High
- **Issue:** Confirmed no rate-limiting middleware/library anywhere in `doqyn-alpha-document-intelligence` (`express-rate-limit` isn't even a dependency). The only inbound throttle is a **tenant quota** (`tenantQuotas.ts`) that's **disabled by default** (`TENANT_QUOTA_ENABLED` must be explicitly `true`) and **fails open** when Redis is unavailable (comment in the code literally says so). Public token-guessable endpoints — `api/share/*`, `api/external-shares/[token]/*`, `api/sign/[token]/*`, `api/verify/signature/[verificationCode]` — have zero rate limiting of any kind.
- **Impact:** Share tokens, signature verification codes, and guest sign/download links can be brute-forced with no throttling at all. This matters more, not less, as you grow — more tenants means more live share links means a larger attack surface for token enumeration.
- **Recommendation:** Add IP-based rate limiting at the nginx layer (simplest, e.g. `limit_req_zone`) for these specific public routes, independent of the tenant-quota mechanism which serves a different purpose (fair-use, not abuse-prevention). Also flip tenant quotas to fail-closed for at least the upload/analysis paths.
- **Priority:** 1

### S-4. Input validation is the exception, not the rule
- **Severity:** High
- **Issue:** Of 122 `api/**` handler files, exactly **one** (`api/auth/login.ts`) uses a zod schema. Everywhere else sampled (`documents/index.ts`, `document-classes/index.ts`, `company-members/invite.ts`, `audit/index.ts`, `internal/tenants/provision.ts`, `document-rules/index.ts`, `access-groups/index.ts`, `documents/upload-url.ts`) uses raw `req.body as {...}` TypeScript type assertions — which are compile-time-only and provide **zero runtime protection**.
- **Impact:** Malformed or malicious payloads (wrong types, unexpected nested objects, oversized strings) reach service/DB code unchecked. Given `zod` is already a project dependency and the pattern exists in one file, this is inconsistency, not a missing capability.
- **Recommendation:** Introduce a thin "validate at the top of every handler" convention starting with the highest-risk write paths (`internal/*`, `company-members/*`, `document-rules/*`, `governance/*`), using `api/auth/login.ts` as the existing template.
- **Priority:** 2

### S-5. File upload MIME type trusted from filename, not content
- **Severity:** Medium-High
- **Issue:** `api/documents/upload.ts:52` derives MIME type via `lookup(filename)` (extension-based), not by sniffing file content or trusting a validated magic-byte check. Path-traversal handling on the storage-key side is genuinely solid (double-layered allowlist regex + resolved-path containment check) — that part is not a concern.
- **Impact:** A file renamed to `x.pdf` containing arbitrary bytes is accepted and tagged `application/pdf`. Combined with the fact that these files are later processed by `pdf-parse`/`sharp`/Ghostscript (all C-library-backed parsers with a history of malformed-input CVEs) and shared with other tenant members via signature/preview flows, this is a stored-malware and processing-library-exploit vector, not just a labeling nitpick.
- **Recommendation:** Validate actual file content (magic-byte/type-sniffing library) before accepting an upload as a given type, independent of what the extension claims.
- **Priority:** 2

### S-6. Internal service-to-service API key comparison isn't constant-time
- **Severity:** Medium
- **Issue:** `server/auth/requireAppInternalApiKey.ts:21` — `token !== expected`, a plain string comparison, not `crypto.timingSafeEqual`.
- **Impact:** Theoretical timing side-channel on the trust boundary between the two services. Low practical likelihood given network jitter, but it's a one-line fix on a security-sensitive comparison and there's no reason not to close it.
- **Recommendation:** Use `crypto.timingSafeEqual` (with a length check first, since it throws on length mismatch).
- **Priority:** 3

### S-7. Auth-service rate limiter silently weakens under horizontal scaling
- **Severity:** Medium
- **Issue:** (Already flagged during codebase mapping, confirmed here.) `doqyn-auth-service/src/security/rateLimit.ts` falls back to a per-process in-memory `Map` when Redis is unreachable. With `AUTH_API_REPLICAS=2` (the shipped default per `setup-production-env.sh`), each replica tracks independent counters — a 10-attempt login-brute-force limit silently becomes effectively 20 whenever Redis has a blip.
- **Impact:** Exactly the scenario this system is designed for (horizontal scaling) is the scenario that weakens its own brute-force protection, and it happens invisibly (no alert on fallback).
- **Recommendation:** Alert/metric when the limiter falls back to memory in production; for login/password-reset/OAuth specifically, consider treating a Redis outage as a hard failure (reject, don't silently degrade) rather than fail-open.
- **Priority:** 3

### S-8. Secrets passed as plain environment variables in Docker Compose
- **Severity:** Medium
- **Issue:** No `secrets:`/external secret files used anywhere in `docker-compose.production.yml`; DB passwords, the internal API keys, encryption keys, R2 credentials, and the Groq API key all flow through plain `environment:`/`env_file`, visible via `docker inspect`/`docker compose config` to anything with host access.
- **Impact:** Standard for many single-tenant VPS deployments and not an urgent fix on its own, but worth tightening given the number of long-lived, high-value secrets involved (data-encryption key, all R2 keys).
- **Recommendation:** Lower urgency than the above; consider Docker Compose's file-based `secrets:` mechanism for the highest-value keys (`DATA_ENCRYPTION_KEY`, R2 admin credentials) if/when infra work is scheduled anyway.
- **Priority:** 4

### S-9. No redaction layer in logging
- **Severity:** Low-Medium
- **Issue:** `server/utils/logger.ts` does `JSON.stringify({...meta})` with zero key-based scrubbing (no denylist for `password`/`token`/`authorization`/`secret`). `AI_PIPELINE_DEBUG` defaults **on**, forwarding error details/stack to logs. No verbatim request-body/header logging was found in this pass, but the structural gap means any future call site that logs a request object or error payload containing a token has no safety net.
- **Impact:** Currently no confirmed leak, but this is a landmine for the next person who adds a debug log line under time pressure.
- **Recommendation:** Add a redaction wrapper in `logger.ts` that scrubs known-sensitive key names before `JSON.stringify`, and flip `AI_PIPELINE_DEBUG` to default-off in production.
- **Priority:** 4

### What's already solid (worth knowing, not just fixing)
- CORS on the auth-service is a proper env-configured allowlist (not a wildcard), correctly combined with `credentials: true`.
- Session cookies are `HttpOnly` + `Secure` (prod) + `SameSite=lax` on both services.
- Password hashing on the real auth path uses argon2id with strong parameters (`memoryCost: 65536, timeCost: 3, parallelism: 4`) plus a pepper.
- Storage-key path-traversal handling is genuinely well-built — double-layered allowlist regex plus a resolved-path containment check.
- Presigned URLs are scoped to bucket+key (not bucket-wide), TTL-clamped (60s–3600s), and R2 buckets have no public-ACL code path.

---

## Executive Summary — Top 5 (Performance + Security Combined)

1. **Add Docker resource limits to every service in `docker-compose.production.yml` (P-1).** On a fixed-resource VPS, this is the difference between "one component degrades" and "everything OOM-kills together." Foundational for the "won't break under growth" goal — do this before anything else.
2. **Fix the auth fail-open default and add security response headers (S-1, S-2).** Both are cheap, both are large-blast-radius, and both are the kind of gap that's invisible until it's actively exploited or misconfigured on a fresh deploy.
3. **Fix the dashboard's unbounded queries and the missing search/sort indexes (P-2, P-3).** This is the feature that will visibly, measurably slow down first as your real tenants accumulate real documents over the year — not a hypothetical, a certainty.
4. **Decouple the AI/preview sync-fallback from storage availability (P-4).** Right now, a transient third-party (R2) hiccup can silently convert into a site-wide event-loop stall. This is the least visible failure mode in the whole audit and the hardest to diagnose after the fact.
5. **Add rate limiting to public/guest endpoints and close the input-validation gap (S-3, S-4).** As the app gets more visible and has more live share/sign links in the wild, this is the primary abuse surface — and it currently has none of the usual protections.

---

## Architecture & Tech Suggestions for Hostinger VPS at This Scale

- **Resource governance first, features second.** Nothing below matters if one bad night takes down Postgres because a worker leaked memory. Get P-1 done before scaling traffic.
- **Split Redis's two personalities.** BullMQ data must never be evicted; session cache/quotas can be. Either two logical DBs with different `maxmemory-policy` values, or two Redis instances if the VPS has headroom. Cheap to do now, painful to untangle later once job-loss incidents start happening.
- **Push static-asset and security concerns into nginx, once.** Compression, cache-control, and security headers are all single-file, zero-app-code changes (P-8, S-2) that pay off on every single request. Do these together as one pass.
- **Add CI.** There is currently no `.github/workflows` (or equivalent) at all — the tenant-isolation guard script, the env-sync check, and `npm audit` all exist as manual `npm run` commands that rely on developer discipline. This is exactly the gap that let the "temporary auth defaults on" and the "no_ai still depends on Mongo" bugs ship silently. A basic CI gate (even just running the existing guard scripts + `npm test`) is disproportionately high-leverage for a small team.
- **Consider offloading MongoDB to Atlas if not already fully committed to self-hosting it.** The codebase already supports Atlas (`mongodb+srv://`, `MONGODB_USE_ATLAS`) — removing Mongo from the VPS's own resource budget is probably the single highest-leverage infrastructure change available, since the tenant-scoped document/audit-log workload is the most read/write-heavy part of the system and the one most exposed to the missing-index issues above. A managed tier also sidesteps needing to hand-tune Mongo memory/cache settings on a resource-constrained box.
- **Add basic error tracking.** Prometheus/Grafana (already wired) covers infrastructure metrics, but there's no exception-level visibility (no Sentry or self-hosted equivalent like GlitchTip). At 4,000 users, intermittent/hard-to-reproduce errors become the norm, not the exception, and structured logs alone make root-causing them much slower than it needs to be.
- **Add a circuit breaker for the `no_ai` → Mongo dependency (known bug).** Every "no AI" analysis request still depends on a Mongo lookup for class/rule resolution — a documented cause of a real production incident. This should fail fast/independently rather than coupling a supposedly-lightweight code path to full Mongo availability.

---

## Most Critical Code to Refactor First

Ordered by how directly each blocks the "won't break under growth" goal:

1. **`server/services/dashboardOverviewService.ts`** — unbounded queries on the most-viewed page; convert to server-side aggregation.
2. **`server/utils/documentListQuery.ts` / `server/db/tenantIndexes.ts`** — add indexes for sort/search fields; resolve the drift against `setupMongo.ts`.
3. **`server/auth/authConfig.ts`, `server/auth/tempUser.ts`, `api/auth/login.ts`** — flip the auth-provider default to fail-closed, or delete the legacy path outright.
4. **`server/services/enqueuePdfAnalysisJob.ts` / `api/ai/analyze-pdf.ts`** — decouple the sync-fallback trigger from storage availability so a storage blip can't silently block the event loop.
5. **`deploy/docker-compose.production.yml` + `deploy/nginx/default.conf`** — resource limits, Redis maxmemory, gzip/cache-control/security headers. Not application code, but the highest-leverage single pass available given how many findings above it resolves at once.
6. **Input-validation layer across `api/**`** — introduce the zod-per-handler convention starting with `internal/*`, `company-members/*`, `document-rules/*`, `governance/*`.

---

*Audit conducted 2026-07-15 against commit `8cd02f6`.*
