# DOQYN Alpha — Document Intelligence

## What This Is

A multi-tenant SaaS platform for document management with AI-assisted classification, metadata extraction, e-signature, sharing, and governance workflows. React 19 SPA + Vercel-style Node API, MongoDB primary datastore, Redis/BullMQ for async AI analysis and preview generation, Cloudflare R2 for file storage. Identity/auth is fully delegated to a sibling microservice (`doqyn-auth-service`, Fastify + PostgreSQL). Deployed via Docker Compose on a self-managed VPS (Hostinger).

## Core Value

Tenants can securely upload, analyze, and manage documents — the system must stay reliable and fast as real tenant load grows, not just work in demos.

## Requirements

### Validated

- ✓ Document upload → AI classification/metadata extraction (Groq + optional Vision OCR) → tenant-scoped MongoDB persistence — existing
- ✓ Multi-tenant data isolation via per-tenant MongoDB collection prefixing — existing
- ✓ Async analysis/preview pipeline via BullMQ workers with sync in-process fallback — existing
- ✓ Session-based auth delegated to `doqyn-auth-service` (cookie + internal API key verification, Redis-cached) — existing
- ✓ E-signature, external sharing, and governance-rules workflows — existing
- ✓ Docker Compose production deployment (VPS) with Prometheus/Grafana observability — existing

### Active

**Scope: apply the 5 P1 findings from `.planning/AUDIT-PERFORMANCE-SECURITY.md` (audit dated 2026-07-15, commit `461bc51`). Nothing else — feature work is deferred to a separate milestone.**

- [ ] Add explicit Docker resource limits/reservations to every service in `deploy/docker-compose.production.yml`, sized to the target Hostinger VPS plan (P-1)
- [ ] Delete the legacy `temporary` auth path entirely (`api/auth/login.ts`, `server/auth/tempUser.ts`, the `temporary`/`doqyn_auth` branching in `authConfig.ts`/`requireAuth.ts`) and make `AUTH_PROVIDER=doqyn_auth` required at boot; add `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` headers centrally in `deploy/nginx/default.conf` (S-1, S-2)
- [ ] Fix `dashboardOverviewService.ts`'s unbounded document/version queries (convert to server-side Mongo aggregation) and add the missing indexes/resolve the index drift between `tenantIndexes.ts` and `setupMongo.ts` for document sort/search fields (P-2, P-3, P-10)
- [ ] Decouple the AI-analysis and preview sync-fallback trigger from storage availability so a transient R2 blip can't silently block the Node event loop in production (P-4)
- [ ] Add rate limiting on public/guest endpoints (`share/*`, `external-shares/*`, `sign/*`, `verify/signature/*`) and introduce zod validation across `api/**` handlers, starting with the highest-risk write paths (`internal/*`, `company-members/*`, `document-rules/*`, `governance/*`) (S-3, S-4)

### Out of Scope

- P2/P3/P4 audit findings (BullMQ tenant fairness, Redis maxmemory policy, N+1 patterns, nginx gzip/cache, upload MIME sniffing, constant-time key comparison, in-memory rate-limit fallback, secrets-in-env, log redaction) — deferred to a later hardening pass, not this milestone
- Any new product features or "the more interesting part" the user has planned — explicitly deferred to a separate future milestone, kept fully out of this one
- Live-migration/zero-downtime concerns — app is pre-launch, no real tenant data at risk yet, so structural changes (like deleting the legacy auth path) are unconstrained by production migration safety

## Context

- Brownfield project; full codebase map exists at `.planning/codebase/*.md` (STACK, ARCHITECTURE, STRUCTURE, CONVENTIONS, TESTING, INTEGRATIONS, CONCERNS), generated 2026-07-15.
- Full performance + security audit exists at `.planning/AUDIT-PERFORMANCE-SECURITY.md`, generated 2026-07-15 against commit `8cd02f6`, targeting a ~4,000-user/1-year growth horizon on a resource-limited Hostinger VPS. This PROJECT.md's Active requirements are a direct, scoped extraction from that audit's P1 section.
- App is **not yet launched** — no real tenant data in production, which removes the usual migration/downtime caution from this round of changes.
- User plans to use a stronger model profile when executing these fixes (see Key Decisions).

## Constraints

- **Deployment target**: Hostinger VPS via Docker Compose (`deploy/docker-compose.production.yml`) — resource limits must be sized to a real, limited VPS plan, not assumed-generous cloud defaults.
- **Scope discipline**: This milestone is P1-only by explicit user decision; P2-P4 findings and new features must not be pulled in opportunistically during execution.
- **No live-migration risk**: Pre-launch status means structural/breaking changes (e.g., deleting legacy auth) are acceptable without a migration path.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Scope this milestone to audit P1 findings only (5 items) | User wants feature work handled as a separate, later milestone | — Pending |
| Delete legacy `temporary` auth entirely rather than just flipping the default to fail-closed | App is pre-launch; `doqyn_auth` is already the canonical provider everywhere else; no reason to carry two auth paths | — Pending |
| Use a stronger model profile for execution of these fixes | User's explicit preference given the sensitivity of auth/infra changes | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-15 after initialization*
