# Roadmap: DOQYN Alpha — Audit Hardening (P1)

## Overview

This is a brownfield hardening milestone, not a feature build. It applies the 5 P1 findings from `.planning/AUDIT-PERFORMANCE-SECURITY.md` so the platform stays reliable and fast as real tenant load grows toward the ~4,000-user/1-year horizon on a resource-limited Hostinger VPS. Work is grouped by technical layer: first the deploy/edge config layer (docker resource limits + nginx security headers + nginx rate limiting), then the application auth layer (delete legacy fail-open auth), then the MongoDB query/index layer (dashboard aggregation + search/sort indexes), and finally the Node request-path layer (decouple the storage-coupled sync fallback + add zod validation on the highest-risk write handlers). Every phase is independently verifiable and closes a distinct class of growth-time failure.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Deploy & Edge Hardening** - Docker resource limits on every service, plus nginx security headers and public-endpoint rate limiting
- [ ] **Phase 2: Auth Provider Fail-Closed** - Delete the legacy `temporary` auth path and make `AUTH_PROVIDER=doqyn_auth` required at boot
- [ ] **Phase 3: MongoDB Query & Index Layer** - Server-side dashboard aggregation and index-backed document sort/search from a single index source of truth
- [ ] **Phase 4: Request-Path Reliability & Validation** - Decouple the sync AI/preview fallback from storage availability and add zod validation to high-risk write handlers

## Phase Details

### Phase 1: Deploy & Edge Hardening
**Goal**: The deploy/edge config layer (`deploy/docker-compose.production.yml` + `deploy/nginx/default.conf`) governs resources and protects the public edge, so no single container can OOM the host and public/guest routes and responses are hardened at the chokepoint.
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, AUTHSEC-03, SEC-01
**Success Criteria** (what must be TRUE):
  1. `docker compose -f deploy/docker-compose.production.yml config` shows explicit `deploy.resources.limits` (memory + cpus) on every service (mongo, redis, postgres-auth, doqyn-api, doqyn-worker, doqyn-worker-preview, auth-api, nginx, and the rest), sized to the target Hostinger VPS plan.
  2. Datastore services (mongo, postgres-auth, redis) declare guaranteed memory `reservations`, and bursty workers (doqyn-worker, doqyn-worker-preview) are tightly capped, so a runaway worker cannot get a datastore OOM-killed.
  3. `curl -I` against a production route returns `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, and `Referrer-Policy` headers on every response.
  4. A rapid burst of requests to `/api/share/*`, `/api/external-shares/*`, `/api/sign/*`, or `/api/verify/signature/*` starts returning 429/503 from nginx once the per-IP limit is exceeded, while normal traffic is unaffected.
**Plans**: 3 plans
- [ ] 01-01-PLAN.md — Docker resource limits + datastore reservations + worker caps (INFRA-01)
- [ ] 01-02-PLAN.md — Nginx security headers + public-route per-IP rate limiting (AUTHSEC-03, SEC-01)
- [ ] 01-03-PLAN.md — Runtime verification: header/rate-limit smoke-check + guest-CSP human-verify (INFRA-01, AUTHSEC-03, SEC-01)

### Phase 2: Auth Provider Fail-Closed
**Goal**: The application auth layer has exactly one authentication path (`doqyn_auth`), and a misconfigured deploy refuses to start rather than silently exposing the legacy single-admin login.
**Depends on**: Phase 1
**Requirements**: AUTHSEC-01, AUTHSEC-02
**Success Criteria** (what must be TRUE):
  1. `api/auth/login.ts` and `server/auth/tempUser.ts` no longer exist, and grep for `temporary` / `TEMP_AUTH_ENABLED` / `isTemporaryAuthEnabled` across `authConfig.ts`, `requireAuth.ts`, and the codebase returns zero matches.
  2. The app throws on boot and refuses to start when `AUTH_PROVIDER` is unset or set to anything other than `doqyn_auth` (no silent fallback to a legacy path).
  3. With `AUTH_PROVIDER=doqyn_auth`, the app boots and authenticated requests still verify against `doqyn-auth-service` via the cookie + internal-API-key + Redis session-cache path exactly as before (no auth regression).
**Plans**: TBD

### Phase 3: MongoDB Query & Index Layer
**Goal**: The MongoDB data-access layer serves the most-used read paths from server-side aggregation and matching indexes, with index definitions unified into a single source of truth, so query cost stops scaling with each tenant's total document count.
**Depends on**: Phase 2
**Requirements**: DATA-01, DATA-02, DATA-03
**Success Criteria** (what must be TRUE):
  1. The tenant dashboard overview is computed by a single server-side Mongo aggregation (`$facet`/`$group`); the unbounded `.find(...).toArray()` full-collection loads in `dashboardOverviewService.ts` are gone, and Node receives only the aggregate numbers the dashboard renders.
  2. `explain()` on document list sort-by-name, sort-by-category, and full-text document search reports `IXSCAN` (index use), not `COLLSCAN`.
  3. Index definitions live in a single source of truth (`tenantIndexes.ts`), the drifted duplicates in `setupMongo.ts` are removed, and the production `doqyn-api-indexes` job is confirmed to create indexes from that source.
**Plans**: TBD

### Phase 4: Request-Path Reliability & Validation
**Goal**: The Node request-handling layer degrades safely and rejects bad input: a transient storage blip can no longer silently convert AI/preview work into event-loop-blocking synchronous processing, and the highest-risk write handlers validate their payloads before touching service/DB code.
**Depends on**: Phase 3
**Requirements**: RELIABILITY-01, SEC-02
**Success Criteria** (what must be TRUE):
  1. In production the synchronous AI-analysis/preview path activates only when an explicit deploy-time flag (e.g. `ANALYSIS_SYNC_FALLBACK=true`) is set; `isAsyncPdfAnalysisAvailable()` (and the preview equivalent in `documentPreviewScheduling.ts`) no longer gate the async path on `isStorageConfigured()`.
  2. When the async path is unavailable in production, the request fails fast with a retryable 503 instead of running `pdf-parse`/Groq/`sharp`/Ghostscript synchronously inside the request handler.
  3. Write handlers under `api/internal/*`, `api/company-members/*`, `api/document-rules/*`, and `api/governance/*` parse request bodies through zod schemas (following the `api/auth/login.ts` template) and reject malformed payloads with a 400 before any service/DB call.
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Deploy & Edge Hardening | 0/3 | Not started | - |
| 2. Auth Provider Fail-Closed | 0/TBD | Not started | - |
| 3. MongoDB Query & Index Layer | 0/TBD | Not started | - |
| 4. Request-Path Reliability & Validation | 0/TBD | Not started | - |
