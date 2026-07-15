# Codebase Structure

**Analysis Date:** 2026-07-15

## Directory Layout

```
doqyn-alpha-document-intelligence/
├── api/                    # HTTP handlers, Vercel-style (one file = one route)
│   ├── documents/          # Document CRUD, upload, sharing, signatures, batch ops
│   ├── ai/                 # AI analysis endpoints + async job polling
│   ├── auth/               # Legacy `temporary` auth endpoints (login/me/logout)
│   ├── governance/         # Governance connections
│   ├── og/                 # OpenGraph image endpoints for guest share/sign links
│   ├── sign/, signature-requests/, external-shares/, share/  # e-signature & sharing
│   ├── company-members/, access-groups/, document-classes/, document-categories/,
│   │   document-groups/, document-rules/, document-extraction-rules/  # Governance config
│   ├── internal/           # Server-to-server endpoints (tenant provisioning/sync)
│   └── ... (audit, dashboard, favorites, profile, settings, tracking, trash, users, verify)
├── server/                 # Business logic, not directly HTTP-routed
│   ├── ai/                 # PDF/OCR extraction, classification, metadata extraction (Groq/Vision)
│   ├── auth/                # Session verification, permissions, provider abstraction
│   ├── tenancy/              # Tenant resolution, per-tenant Mongo collections, storage scope, quotas
│   ├── services/             # Domain services consumed by api/ handlers
│   ├── queues/, workers/      # BullMQ queues + worker entry points (analysis, preview)
│   ├── storage/               # Storage provider abstraction (R2 / local disk)
│   ├── db/                    # Mongo client, DB name resolution, index setup, shared types
│   ├── audit/, governance/, metrics/, redis/, health/, config/, models/, preview/, og/, utils/
│   ├── apiServer.ts           # Shared HTTP dispatcher (route table → api/*.ts handler)
│   ├── dev-server.ts          # Dev entrypoint (npm run dev:api)
│   └── production-server.ts   # Production entrypoint (npm run start:api)
├── src/                     # Frontend React SPA
│   ├── app/                  # Router, providers, lazy route map, top-level App component
│   ├── auth/                  # doqyn_auth client (session fetch/cache/context)
│   ├── features/              # One folder per business domain (see below)
│   ├── components/            # Design system: ui/, layout/, brand/, governance/, decorative/, visual/
│   ├── contexts/, hooks/, lib/, pages/, stores/, styles/, types/, utils/, legal/, shared/
│   └── main.tsx                # React root bootstrap
├── shared/                  # Code shared between frontend and backend (no bundler/runtime split)
├── scripts/                 # One-off/maintenance scripts (Mongo audits, migrations, R2 tooling, seeds)
├── tests/                   # Flat directory of `*.test.ts` files (Node's built-in test runner via tsx)
├── docs/                    # Architecture, deploy, auth-integration, and per-feature "RELATORIO_*" reports
├── deploy/                  # Docker, nginx, production env templates, observability (Prometheus/Grafana)
├── backups/                 # Mongo cleanup backup dumps (generated, not source)
├── logos/                   # Static brand image assets referenced by scripts/build
├── reports/                 # Generated audit report text files (not source)
├── prisma/                  # Present but this repo uses MongoDB — check before use (see Special Directories)
├── dist/                    # Build output (esbuild server bundle + tsc + vite) — generated, gitignored
├── vite.config.ts, tsconfig*.json, eslint.config.js, .prettierrc, vitest.config.ts
└── docker-compose.yml, docker-compose.production.yml
```

**Sibling repo (separate deploy unit, referenced but not part of this repo):**
```
doqyn-auth-service/          # /home/a1rm4x/Documents/GitHub/doqyn-auth-service
├── src/
│   ├── modules/              # auth, sessions, memberships, tenants, invites, signups, oauth, admin...
│   ├── integrations/          # appProvisioning.ts, memberSync.ts — calls back into this repo's /api/internal/*
│   ├── security/               # cookies, crypto, password (argon2), rate limiting, session tokens
│   ├── redis/, config/, demo/, dev/, utils/
│   └── server.ts               # Fastify entrypoint, port 4100
└── prisma/                    # Actual Prisma schema (PostgreSQL) lives here, not in the Alpha repo
```

## Directory Purposes

**`api/`:**
- Purpose: HTTP entrypoints only — one file per route, thin (auth/tenant context → call a `server/services/*` function → shape response).
- Contains: `export default async function handler(req: VercelRequest, res: VercelResponse)` per file. Dynamic segments use bracket folders (`[documentId]`, `[token]`, `[jobId]`).
- Key files: `api/documents/upload.ts` (multipart parsing), `api/ai/analyze-pdf.ts` (analysis kickoff), `api/documents/confirm-analysis.ts` (persistence), `api/me.ts` (session aggregation).

**`server/`:**
- Purpose: All business logic, data access, and infrastructure glue that is not itself an HTTP route.
- Contains: services, tenancy resolution, auth verification, AI pipeline, queues/workers, storage providers, DB client/types.
- Key files: `server/apiServer.ts` (route table — must be updated when adding a new `api/*.ts` file), `server/tenancy/getTenantCollections.ts` (tenant-scoped Mongo access), `server/auth/requireAuth.ts`.

**`src/features/`:**
- Purpose: One folder per business/domain capability; the primary unit of frontend code organization (not layered by technical role at the top level).
- Contains (per feature, as applicable): `api/` (fetch wrappers over `src/lib/api.ts`), `components/`, `hooks/`, `utils/`, `types.ts`, top-level page/route component.
- Present domains: `access-request`, `audit`, `auth`, `company-signup`, `dashboard`, `document-send`, `document-update-version`, `documents`, `external-share`, `guest-portal`, `individual-signup`, `invite`, `library`, `profile`, `rules` (governance flow, uses `@xyflow/react`), `settings`, `sharing`, `signature`, `tenant`, `tracking`, `upload`, `users`, `versioning`.

**`src/components/`:**
- Purpose: Shared design system and cross-feature UI, not tied to one business domain.
- Contains: `ui/` (buttons, popover, primitives — likely shadcn-style, given `class-variance-authority`/`tailwind-merge`), `layout/` (`AppLayout`, shell chrome), `brand/`, `governance/` (cards/columns/modals/skeletons shared across governance screens), `decorative/`, `visual/`.

**`src/app/`:**
- Purpose: Application shell — routing table, provider composition, lazy route registry, workspace layout.
- Key files: `routes.tsx` (route tree), `lazyRoutes.tsx` (code-split feature entry points), `providers.tsx` (React Query + auth), `queryClient.ts`, `layout/WorkspaceLayout.tsx`.

**`src/auth/`:**
- Purpose: Client for the `doqyn_auth` cookie-based session (fetch `/api/me`, normalize session shape, expose context/hook).
- Contains: `AuthProvider.tsx`, `useAuth.ts`, `sessionApi.ts`, `authServiceClient.ts`, `mapMeSession.ts`, `oauthLogin.ts`, `sessionFingerprint.ts`.
- Note: distinct from `src/features/auth/`, which wraps this behind a provider-switchable abstraction (`temporary` vs `doqyn_auth`) consumed by `ProtectedRoute`/`PublicRoute`.

**`shared/`:**
- Purpose: Small pure utility modules imported by both `src/` (browser) and `server/`/`api/` (Node) code, to keep formatting/normalization logic identical on both sides.
- Contains: `storageFileName.ts`, `metadataKeyNormalize.ts`.

**`scripts/`:**
- Purpose: Operational tooling — Mongo audits/migrations/backups, R2 bucket audits, demo data seeding, environment sync checks, index management, tenant isolation testing.
- Contains: `.ts` (run via `tsx`) and `.mjs`/`.sh` scripts, each wired to a `package.json` script (e.g. `db:migrate-flat-to-tenant`, `r2:audit-buckets`, `audit:no-flat-writes`).
- Convention: script filenames describe the action directly (`migrate-flat-to-tenant-prefixed.ts`, `drop-empty-legacy-collections.ts`).

**`tests/`:**
- Purpose: All automated tests, flat (no subfolders), run with Node's built-in test runner via `tsx --test tests/**/*.test.ts` (`npm test`).
- Naming: `<feature-or-concern>.test.ts`, kebab-case, matching the domain it exercises (e.g. `document-versioning.test.ts`, `tenant-storage-scope.test.ts`, `phase-b-*.test.ts` for infra/scaling milestones).
- Not co-located with source — tests live entirely under `tests/`, not next to the files they test.

**`docs/`:**
- Purpose: Both living technical documentation (`architecture.md`, `AUTH_INTEGRATION.md`, `LOCAL_DEV.md`, `TENANT_STORAGE_MODEL.md`, `MONGODB_TENANT_ISOLATION.md`, `DEPLOY_VPS.md`, `ENV_SYNC.md`) and a large number of point-in-time audit/change reports (`RELATORIO_*.txt`/`.md`) generated by past work sessions.
- Convention: durable reference docs use lowercase/kebab or `UPPER_SNAKE.md`; one-off audit/change reports use `RELATORIO_<TOPIC>.txt` (Portuguese for "report").

**`deploy/`:**
- Purpose: Everything needed to run this app outside local dev — Docker Compose overrides, nginx config, production env templates, Prometheus/Grafana observability stack, deploy shell scripts.
- Contains: `deploy/env/`, `deploy/nginx/`, `deploy/observability/{alerts,grafana}`, `deploy/scripts/` (+ `deploy/scripts/lib/`), `deploy/secrets/`.

**`.generated/`:**
- Purpose: Build-time or tooling-generated artifacts checked outside `dist/` (verify contents before assuming it's safe to delete or edit by hand).

## Key File Locations

**Entry Points:**
- `src/main.tsx`: Frontend React root bootstrap.
- `server/dev-server.ts` / `server/production-server.ts`: API process entrypoints (both call `startApiServer()` in `server/apiServer.ts`).
- `server/workers/runAnalysisWorker.ts` / `server/workers/runPreviewWorker.ts`: standalone worker process entrypoints.

**Configuration:**
- `vite.config.ts`: Frontend build, `@` alias → `src/`, dev proxy for `/api` (→ :3001) and `/auth`, `/oauth` (→ :4100).
- `tsconfig.json` (+ `tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.server.json`): split TS project references for app/node/server contexts.
- `eslint.config.js`, `.prettierrc`: lint/format rules (flat ESLint config, Prettier with Tailwind plugin).
- `.env.example`: canonical list of required environment variables (never read `.env` directly — treat as secret).
- `server/db/constants.ts` / `server/db/database.ts`: canonical Mongo database name and legacy flat collection name constants.

**Core Logic:**
- `server/tenancy/getTenantCollections.ts`: tenant-scoped Mongo collection resolution — the load-bearing multi-tenancy abstraction.
- `server/auth/requireAuth.ts`, `server/tenancy/documentRequestContext.ts`: auth + tenant context guards used at the top of nearly every handler.
- `server/apiServer.ts`: route table mapping URL → `api/*.ts` handler for dev/VPS execution.
- `server/ai/services/analyzePdfService.ts`, `server/workers/analysisWorker.ts`: AI analysis pipeline orchestration.

**Testing:**
- `tests/*.test.ts`: all tests, run via `npm test` (`tsx --test tests/**/*.test.ts`).
- `vitest.config.ts`: present but the primary `test` script uses Node's built-in runner via `tsx`, not Vitest directly — check which is actually invoked (`npm test`) before assuming Vitest conventions apply here (Vitest is used by the sibling `doqyn-auth-service` repo instead).

## Naming Conventions

**Files:**
- React components: `PascalCase.tsx` (e.g. `DocumentViewerModal.tsx`, `WorkspaceLayout.tsx`).
- Non-component TS modules (services, hooks, utils, API clients): `camelCase.ts` (e.g. `documentService.ts`, `useDocuments.ts`, `resolveTenantStorageScope.ts`).
- API route handlers: match the URL path segment, `kebab-case.ts` or `camelCase.ts` matching Vercel's file-based routing, with `[param]` bracket folders/files for dynamic segments (e.g. `api/documents/[documentId]/shares/[shareId].ts`).
- Test files: `<topic-kebab-case>.test.ts` under flat `tests/`.
- One-off scripts: `<verb>-<object>-<qualifier>.ts`, kebab-case, describing the action (e.g. `migrate-flat-to-tenant-prefixed.ts`, `r2-cleanup-empty-demo-buckets.ts`).

**Directories:**
- Backend: singular/plural matches the domain noun as used in the DB/API (`server/services/`, `server/tenancy/`, `server/queues/`).
- Frontend: `src/features/<domain>` uses the domain name as it appears in product language, generally singular for a capability (`upload`, `library`, `signature`) — check the existing folder before introducing a new one, since some domains are compound (`document-send`, `document-update-version`, `individual-signup`).
- Dynamic route segments (both `api/` and referenced by `src/app/routes.tsx`) follow Next.js/Vercel bracket convention: `[documentId]`, `[token]`, `[jobId]`.

## Where to Add New Code

**New Feature (frontend):**
- Create `src/features/<new-domain>/` with `api/`, `components/`, `hooks/` as needed; add a route-level entry component and register it in `src/app/lazyRoutes.tsx`, then wire the path in `src/app/routes.tsx` (inside `ProtectedRoute`/`AppLayout` if it needs the authenticated shell).
- Tests: add `tests/<feature-name>-<aspect>.test.ts` (flat, no subfolder).

**New API endpoint (backend):**
- Add `api/<path>.ts` (or `api/<path>/[param].ts` for dynamic segments) with a default-exported `handler(req, res)`.
- **Required second step:** register the route in `server/apiServer.ts` — add to `staticRoutes` for a static path, or to the `patterns` array (with a `RoutePattern` regex + `paramKeys`) for a dynamic path. Skipping this makes the endpoint unreachable outside a literal Vercel deployment.
- Put actual logic in a new or existing `server/services/*.ts` function; the handler itself should stay thin (auth/tenant context → service call → response shaping), matching the pattern in `api/documents/upload.ts`.

**New business logic / service:**
- Add to `server/services/` (or the relevant subfolder: `analysis/`, `confirm/`, `favorites/`, `preview/`, `profile/`, `sharing/`, `signatures/`, `tracking/`, `trash/`).
- If it needs document/tenant data, obtain collections via `getTenantCollections`/`getTenantDbCollections` (`server/tenancy/getTenantCollections.ts`) — never hardcode a flat collection name from `server/db/constants.ts` in new code.
- Raise expected failures as `ServiceError` (`server/utils/serviceErrors.ts`), not thrown plain `Error`s or `null` returns.

**New Mongo collection / index:**
- Add the Mongo type to `server/db/types.ts`, wire it into `TenantCollections`/`TenantDbCollections` in `server/tenancy/getTenantCollections.ts`, and add an index bootstrap file alongside the existing ones in `server/db/` (pattern: `server/db/<feature>Indexes.ts`), registered from `server/db/tenantIndexes.ts` or `server/db/setupMongo.ts`.

**Utilities:**
- Frontend-only shared helpers: `src/lib/`.
- Backend-only shared helpers: `server/utils/`.
- Helpers needed identically on both frontend and backend: `shared/` (import from both `src/` and `server/`/`api/`).

## Special Directories

**`dist/`:**
- Purpose: Build output (esbuild-bundled server + `tsc` + Vite client bundle).
- Generated: Yes (via `npm run build`).
- Committed: No (gitignored) — but present on disk in this checkout; do not hand-edit.

**`backups/`, `reports/`:**
- Purpose: Generated artifacts from Mongo cleanup/audit scripts (timestamped dumps and text reports).
- Generated: Yes.
- Committed: Mixed — verify against `.gitignore` before assuming these are tracked; treat as disposable, regenerable output rather than source of truth.

**`.generated/`:**
- Purpose: Tooling/build-generated files outside the standard `dist/` output path.
- Generated: Yes.
- Committed: Check `.gitignore` before editing by hand.

**`prisma/`:**
- Purpose: A `prisma/` folder exists in this repo despite the app using MongoDB (not Prisma/Postgres) as its primary datastore — the real Prisma schema for this system lives in the sibling `doqyn-auth-service/prisma/`. Confirm actual contents/usage here before relying on it; it may be vestigial or scoped to a narrow legacy use.
- Generated: No (schema source), but check before treating as active.

**`docs/*RELATORIO_*` / `docs/*.txt`:**
- Purpose: Historical, point-in-time audit and change reports (Portuguese-language), useful for understanding *why* something is the way it is, but not living documentation — do not treat as current-state truth without cross-checking against actual code.
- Generated: Manually written per work session, not code-generated, but describes past states that may since have changed.

**`node_modules/`, `dist/`, `.git/`:**
- Standard — excluded from all structural analysis above.

---

*Structure analysis: 2026-07-15*
