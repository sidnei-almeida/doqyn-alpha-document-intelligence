# Requirements: DOQYN Alpha — Audit Hardening (P1)

**Defined:** 2026-07-15
**Core Value:** Tenants can securely upload, analyze, and manage documents — the system must stay reliable and fast as real tenant load grows, not just work in demos.
**Source:** `.planning/AUDIT-PERFORMANCE-SECURITY.md` (2026-07-15, commit `461bc51`) — P1 section only, per explicit scope decision in `PROJECT.md`.

## v1 Requirements

### Infrastructure Resource Limits

- [ ] **INFRA-01**: Every service in `deploy/docker-compose.production.yml` declares explicit memory and CPU limits/reservations sized to the target Hostinger VPS plan, so no single runaway container can exhaust host resources and take down unrelated services

### Legacy Auth Removal & Security Headers

- [ ] **AUTHSEC-01**: The legacy `temporary` auth provider code path (`api/auth/login.ts`, `server/auth/tempUser.ts`, and the related `temporary`/`doqyn_auth` branching in `authConfig.ts`/`requireAuth.ts`) is fully removed from the codebase
- [ ] **AUTHSEC-02**: The application refuses to boot unless `AUTH_PROVIDER=doqyn_auth` is explicitly set (no silent fallback)
- [ ] **AUTHSEC-03**: Every HTTP response served through the production nginx layer includes `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, and `Referrer-Policy` headers

### Dashboard Query & Index Hardening

- [ ] **DATA-01**: The tenant dashboard overview is computed via a server-side MongoDB aggregation pipeline instead of loading full document/version collections into Node memory to bucket-count in JS
- [ ] **DATA-02**: Document list sort-by-name, sort-by-category, and full-text document search are backed by matching MongoDB indexes (verified via `explain()` — no collection scans on these paths)
- [ ] **DATA-03**: `server/db/setupMongo.ts` and `server/db/tenantIndexes.ts` index definitions are reconciled into a single source of truth, and the production index-creation job (`doqyn-api-indexes`) is confirmed to run from it

### AI/Preview Pipeline Reliability

- [ ] **RELIABILITY-01**: The synchronous AI-analysis/preview fallback path in production can only activate via an explicit deploy-time flag — never as a silent side-effect of transient storage (R2) unavailability

### Public Endpoint Abuse Protection & Input Validation

- [ ] **SEC-01**: Public/guest endpoints (`api/share/*`, `api/external-shares/[token]/*`, `api/sign/[token]/*`, `api/verify/signature/[verificationCode]`) enforce IP-based rate limiting
- [ ] **SEC-02**: The highest-risk write endpoints (`api/internal/*`, `api/company-members/*`, `api/document-rules/*`, `api/governance/*`) validate request bodies with zod schemas before use, following the existing pattern in `api/auth/login.ts`

## v2 Requirements

Deferred to a later hardening pass (audit findings P2–P4, not in this milestone's roadmap):

### Performance (P2–P3)

- **PERF-01**: Per-tenant BullMQ queue fairness / preview-queue tenant concurrency cap
- **PERF-02**: Redis `maxmemory` + eviction policy, split by data-safety class (BullMQ vs session cache/quotas)
- **PERF-03**: Batch N+1 sequential-await patterns (`governanceMembersService.ts`, batch document move/trash/restore)
- **PERF-04**: Nginx gzip/brotli compression + `Cache-Control` headers for static assets
- **PERF-05**: In-process LRU layer in front of the Redis session-cache lookup

### Security (P3–P4)

- **SEC-04**: Constant-time internal API key comparison (`crypto.timingSafeEqual`)
- **SEC-05**: Fail-loud (alert/metric) when the auth-service rate limiter falls back to in-memory counters
- **SEC-06**: File upload content-sniffing (magic bytes) instead of trusting the filename extension for MIME type
- **SEC-07**: Docker Compose `secrets:` mechanism for the highest-value secrets (data-encryption key, R2 admin credentials)
- **SEC-08**: Redaction layer in `server/utils/logger.ts`; `AI_PIPELINE_DEBUG` default-off in production

## Out of Scope

| Feature | Reason |
|---------|--------|
| New product features ("the more interesting part") | Explicitly deferred by user to a separate future milestone — kept fully out of this hardening cycle |
| Live-migration / zero-downtime tooling for these fixes | App is pre-launch with no real tenant data at risk; structural changes (e.g. deleting legacy auth) don't need a migration path |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | TBD (roadmapper) | Pending |
| AUTHSEC-01 | TBD (roadmapper) | Pending |
| AUTHSEC-02 | TBD (roadmapper) | Pending |
| AUTHSEC-03 | TBD (roadmapper) | Pending |
| DATA-01 | TBD (roadmapper) | Pending |
| DATA-02 | TBD (roadmapper) | Pending |
| DATA-03 | TBD (roadmapper) | Pending |
| RELIABILITY-01 | TBD (roadmapper) | Pending |
| SEC-01 | TBD (roadmapper) | Pending |
| SEC-02 | TBD (roadmapper) | Pending |

**Coverage:**
- v1 requirements: 10 total
- Mapped to phases: 0 (pending roadmap creation)
- Unmapped: 10 ⚠️ (will be resolved by roadmapper)

---
*Requirements defined: 2026-07-15*
*Last updated: 2026-07-15 after initial definition*
