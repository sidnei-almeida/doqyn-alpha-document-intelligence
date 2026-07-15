# Technology Stack

**Analysis Date:** 2026-07-15

## Languages

**Primary:**
- TypeScript (strict mode) - used across frontend (`src/`), backend API handlers (`api/`), server runtime (`server/`), and shared code (`shared/`)

**Secondary:**
- Bash - deployment/ops scripts (`deploy/scripts/*.sh`, `scripts/mongo-backup-before-cleanup.sh`)
- SQL - implicit via Prisma migrations in the sibling `doqyn-auth-service` repo (not this repo)

This repo (`doqyn-alpha-document-intelligence`) is one half of a two-service system. The sibling repo `doqyn-auth-service` (path: `/home/a1rm4x/Documents/GitHub/doqyn-auth-service`) is a separate, independently-deployed Fastify + Prisma/PostgreSQL authentication microservice. See INTEGRATIONS.md for how the two communicate.

## Runtime

**Environment:**
- Node.js 22 (Docker images pin `node:22-bookworm-slim`, see `docker/Dockerfile.api`, `docker/Dockerfile.worker`, `docker/Dockerfile.web`)
- No `.nvmrc` or `engines` field present in `package.json` — Node version is only enforced via Docker base images

**Package Manager:**
- npm (lockfile present: `package-lock.json`)
- Install: `npm ci` in Docker builds

## Frameworks

**Core (frontend):**
- React 19.1 (`react`, `react-dom`) - UI library
- React Router 7.5 (`react-router-dom`) - client-side routing
- Vite 6.3 (`vite`, `@vitejs/plugin-react`) - dev server & build tool, config in `vite.config.ts`
- TanStack React Query 5.74 (`@tanstack/react-query`) - server-state/data-fetching cache
- Zustand 5.0 (`zustand`) - client-side state stores (`src/stores/`)
- React Hook Form 7.56 + Zod 3.24 (`react-hook-form`, `@hookform/resolvers`, `zod`) - forms and schema validation
- Tailwind CSS 3.4 (`tailwindcss`, `postcss.config.js`, `tailwind.config.js`) - styling
- `@xyflow/react` 12.11 - node/graph diagram UI (governance rules map, `src/features/rules`)
- `@dnd-kit/core` / `@dnd-kit/utilities` - drag-and-drop interactions

**Core (backend/API):**
- No HTTP framework wrapper — API routes are plain Vercel-style serverless handlers under `api/**/*.ts` (Vercel Node functions, `@vercel/node` types), and a lightweight custom dev/production Node HTTP server (`server/dev-server.ts`, `server/production-server.ts`) that dispatches to those same handler modules outside Vercel
- BullMQ 5.80 (`bullmq`) - Redis-backed job queues for async document analysis and PDF preview generation (`server/queues/`, `server/workers/`)

**Testing:**
- Node built-in test runner via `tsx --test` (`npm test` → `tsx --test tests/**/*.test.ts`) - no Jest/Vitest in this repo (contrast with `doqyn-auth-service`, which uses Vitest)
- Ad hoc smoke-test scripts for AI provider under `scripts/test-groq-*.mjs`, `scripts/test-no-ai.mjs`

**Build/Dev:**
- `tsx` 4.19 - TypeScript execution for dev server, workers, and all `scripts/*.ts` maintenance/ops scripts
- `esbuild` 0.25 - used by `scripts/build-server.mjs` to bundle the server/API code for production (`build:server` step)
- TypeScript 5.8 (project-references setup: `tsconfig.json` → `tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.server.json`)
- ESLint 9 flat config (`eslint.config.js`) + `typescript-eslint` 8.30
- Prettier 3.5 (`.prettierrc`) with `prettier-plugin-tailwindcss` for class sorting
- `concurrently` 10.0 - runs API dev server + Vite dev server together (`npm run dev`)

## Key Dependencies

**Critical:**
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

**Infrastructure:**
- `@vercel/node` 5.1 (devDependency) - type definitions/runtime shim for Vercel serverless function signature, also used for local Vercel-shaped deployment (`vercel.json`)
- `dotenv` 16.5 - env var loading in dev/scripts context

## Configuration

**Environment:**
- All runtime configuration via environment variables, documented exhaustively in `.env.example` (Portuguese comments)
- `.env` exists locally (gitignored) — contents not inspected (forbidden per security policy)
- Config is read directly from `process.env` inside dedicated config modules rather than a centralized config object, e.g. `server/auth/authConfig.ts`, `server/db/mongoConfig.ts`, `server/redis/redisConfig.ts`, `server/ai/vision/visionConfig.ts`, `server/config/externalSharingConfig.ts`, `server/config/signatureConfig.ts`
- A cross-repo env-sync contract exists between this repo and `doqyn-auth-service`: certain vars must match byte-for-byte between the two `.env` files (`DOQYN_AUTH_INTERNAL_API_KEY` ↔ auth's `DOQYN_INTERNAL_API_KEY`, `DOQYN_APP_INTERNAL_API_KEY`, `DOQYN_AUTH_COOKIE_NAME` ↔ auth's `SESSION_COOKIE_NAME`). Validated via `npm run env:auth-sync` (`scripts/env-auth-sync-check.mjs`) and documented in `docs/ENV_SYNC.md`.

**Build:**
- `vite.config.ts` - frontend build/dev config; path alias `@` → `./src`; manual chunk splitting for `pdfjs-dist`, React, TanStack Query, dnd-kit; dev-server proxies `/api` → `http://localhost:3001` and `/auth`, `/oauth` → `http://127.0.0.1:4100` (the auth service)
- `scripts/build-server.mjs` (esbuild) - bundles `api/`, `server/`, `shared/` into `dist/` for production Node execution
- `tsconfig.server.json` - NodeNext module resolution, ES2022 target, strict mode, covers `api/**`, `server/**`, `shared/**`
- `vercel.json` - rewrites for social-preview crawlers (OG image bot detection) and SPA fallback routing, used when deployed to Vercel as an alternative to the Docker/VPS path

## Platform Requirements

**Development:**
- Node 22, npm
- Local MongoDB (Docker Compose profile `local-mongo`) or MongoDB Atlas
- Optional local Redis for queue/session-cache testing (`REDIS_ENABLED=false` by default in dev — falls back to sync processing)
- Sibling `doqyn-auth-service` running locally on port 4100 for auth flows to work (`DOQYN_AUTH_BASE_URL=http://127.0.0.1:4100`)
- Ghostscript binary required for PDF preview generation (installed in Docker image; must be available locally too for `dev:worker:preview`)

**Production:**
- Docker Compose stack (`deploy/docker-compose.production.yml`) orchestrating: `postgres-auth`, `pgbouncer`, `auth-migrate`, `auth-api` (all from the sibling auth-service repo, built via relative path `../../doqyn-auth-service`), `mongo` (optional profile), `redis`, `doqyn-api`, `doqyn-api-indexes` (one-shot Mongo index job), `doqyn-worker` (analysis), `doqyn-worker-preview`, `nginx` (reverse proxy + static frontend), plus optional `--profile observability` services (`redis-exporter`, `prometheus`, `grafana`)
- Alternative deployment target: Vercel (`vercel.json` present, `@vercel/node` types) for the frontend + API routes, though the documented/primary production path is the Docker/VPS Compose stack
- Custom Docker images: `docker/Dockerfile.api` (Node 22 + Ghostscript + sharp deps), `docker/Dockerfile.worker`, `docker/Dockerfile.web`, `docker/Dockerfile.nginx`

---

*Stack analysis: 2026-07-15*
