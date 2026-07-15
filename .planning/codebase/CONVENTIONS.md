# Coding Conventions

**Analysis Date:** 2026-07-15

## Naming Patterns

**Files:**
- React components: `PascalCase.tsx` — e.g. `src/components/ui/Button.tsx`, `src/features/library/components/FileRow.tsx`
- Hooks: `useX.ts` camelCase with `use` prefix — e.g. `src/features/library/hooks/useFavorites.ts`, `src/hooks/`
- Plain modules (services, utils, types): `camelCase.ts` — e.g. `server/utils/serviceErrors.ts`, `shared/metadataKeyNormalize.ts`
- API route handlers (Vercel-style file routing): lowercase/kebab path segments mirroring the endpoint, dynamic segments in brackets — e.g. `api/documents/[documentId]/favorite.ts`, `api/favorites/documents.ts`
- Test files: `kebab-case.test.ts`, one file per feature/topic, always under `tests/` (flat, not co-located) — e.g. `tests/document-favorites.test.ts`, `tests/r2-storage.test.ts`
- Scripts: `kebab-case.ts` or `.mjs` for one-off/audit scripts — e.g. `scripts/audit-mongodb-schema.ts`, `scripts/mongo-audit.mjs`

**Functions:**
- camelCase, verb-first — `addDocumentFavorite`, `removeDocumentFavorite`, `listFavoriteDocuments`, `buildDocumentListItems`, `resolveDocumentId`
- Boolean-returning helpers prefixed `is`/`has`/`can` — `isServiceError`, `isMongoNativeConfigured`, `canUserListDocumentWithShare`
- Private/internal helpers not exported are declared above their public callers in the same file (e.g. `activeFavoriteFilter`, `getFavoritesCollection` in `server/services/favorites/documentFavoritesService.ts`)

**Variables:**
- camelCase throughout; constants that are truly fixed values use `UPPER_SNAKE_CASE` — e.g. `DOCUMENT_CATEGORY_ID_PREFIX` in `server/utils/entityIds.ts`, `SHARED_APP_COLLECTIONS` in `server/db/constants.ts`
- IDs use string prefixes to disambiguate entity type at a glance — `fav_${randomUUID()}`, `cat_`, `group_`

**Types:**
- PascalCase for types/interfaces, no `I` prefix — `DocumentListItem`, `AuthUser`, `DocumentRequestContext`, `MongoUserDocumentFavorite`
- Mongo-persisted document shapes prefixed `Mongo` — `MongoDocument`, `MongoUserDocumentFavorite` (in `server/db/types.ts`)
- `type` used for unions/shape aliases, `interface` less common; prefer `type` for React prop shapes

## Code Style

**Formatting:**
- Prettier (`.prettierrc`): `semi: true`, `singleQuote: true`, `trailingComma: "all"`, `printWidth: 100`
- Plugin: `prettier-plugin-tailwindcss` — Tailwind class lists in JSX get auto-sorted
- Run via `npm run format` (`prettier --write "src/**/*.{ts,tsx,css}" "api/**/*.ts" "server/**/*.ts"`) — note `scripts/` and `tests/` are NOT included in the format glob

**Linting:**
- ESLint flat config (`eslint.config.js`) using `typescript-eslint` recommended + `eslint-plugin-react-hooks` recommended + `eslint-plugin-react-refresh`
- Applies to `**/*.{ts,tsx}`, ignores `dist` and `node_modules`
- Key rule: `react-refresh/only-export-components` set to `warn` (allows constant exports alongside components, e.g. `buttonVariants.ts` co-located with `Button.tsx`)
- Run via `npm run lint` (`eslint .`)

**TypeScript strictness (`tsconfig.app.json` for `src/` + `shared/`, `tsconfig.server.json` for `server/`+`api/`):**
- `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedSideEffectImports`
- `verbatimModuleSyntax: true` — `import type` must be used explicitly for type-only imports (seen consistently: `import type { VercelRequest, VercelResponse } from '@vercel/node'`)
- `moduleResolution: "bundler"`, `allowImportingTsExtensions: true` — server/script files import relative modules with explicit `.js`/`.ts` extensions (see below)

## Import Organization

**Order (observed convention, not enforced by a plugin):**
1. Node builtins (`node:crypto`, `node:fs`, `node:path`) with `node:` protocol prefix
2. Third-party packages (`mongodb`, `@vercel/node`, `@tanstack/react-query`, `sonner`)
3. Path-aliased internal imports (`@/...`, `@shared/...`)
4. Relative internal imports, deepest/closest last

**Path Aliases (`tsconfig.app.json`):**
- `@/*` → `src/*`
- `@shared/*` → `shared/*`
- Used pervasively in `src/` (frontend) — e.g. `import { useAuth } from '@/auth/useAuth'`
- `server/` and `api/` code does NOT use aliases; it uses relative paths with explicit extensions instead — e.g. `import { ServiceError } from '../../utils/serviceErrors.js'`. **When adding server-side code, always import with the `.js` extension even though the source is `.ts`** (this matches the compiled ESM output and is required by `verbatimModuleSyntax`/`bundler` resolution).

**Type-only imports:**
- Explicit `import type { ... }` for types re-exported or used only as annotations — enforced by convention across the codebase, not just where TS requires it.

## Error Handling

**Server/API pattern — `ServiceError` class (`server/utils/serviceErrors.ts`):**
```typescript
export class ServiceError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;
  readonly payload?: Record<string, unknown>;
  constructor(message: string, code: string, statusCode = 400, details?, payload?) { ... }
}
export function isServiceError(error: unknown): error is ServiceError { ... }
```
- Services throw `new ServiceError(message, code, statusCode)` for expected/business-rule failures (not found, access denied, not configured) — see `server/services/favorites/documentFavoritesService.ts:75,96,111`
- API handlers (`api/**/*.ts`) wrap logic in try/catch and translate `ServiceError` to an HTTP response; unknown errors are **rethrown**, never swallowed:
```typescript
} catch (error) {
  if (isServiceError(error)) {
    return res.status(error.statusCode).json({ message: error.message, code: error.code });
  }
  throw error;
}
```
- Error messages returned to the client are written in Portuguese (pt-BR) and paired with a machine-readable `code` (e.g. `DOCUMENT_NOT_FOUND`, `DOCUMENT_ACCESS_DENIED`, `MONGO_NOT_CONFIGURED`)
- HTTP method dispatch inside handlers: explicit `if (req.method === 'POST')` / `'DELETE'` blocks, falling through to `405` for unsupported methods

**Frontend pattern:**
- `sonner` toast for user-facing error surfacing — `toast.error('Não foi possível atualizar os favoritos. Tente novamente.')` in mutation `onError` (React Query)
- React Query mutations use `onMutate` (optimistic update) / `onError` (rollback/toast) / `onSettled` (invalidate queries) — see `src/features/library/hooks/useFavorites.ts`
- `src/components/ui/AppErrorBoundary.tsx` — top-level React error boundary component

## Logging

**Framework:** Custom lightweight logger — `server/utils/logger.ts`
```typescript
export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),
  debug: (message: string, meta?: Record<string, unknown>) => log('debug', message, meta),
};
```
- Emits structured JSON (`{ timestamp, level, message, ...meta }`) via `console.log`/`console.warn`/`console.error`
- Prefer `logger.info/warn/error(message, meta)` over raw `console.*` in server code. Direct `console.*` calls still exist in ~19 places across `server/` and `src/` — treat these as debt, not the target pattern (see CONCERNS.md if generated).

## Comments

**When to Comment:**
- Sparse; code favors self-explanatory naming over comments
- Short JSDoc-style block comments used above exported hooks/functions to explain a non-obvious business rule, in Portuguese — e.g. in `useFavorites.ts`:
```typescript
/**
 * Favoritos são preferência pessoal do usuário (userId), persistidos no MongoDB.
 */
export function useFavorites() { ... }
```
- No enforced JSDoc/TSDoc coverage requirement; types + descriptive names carry most of the documentation burden

**Language:** UI copy, error messages, and explanatory comments are in Portuguese (pt-BR). Identifiers (function/variable/type names) are in English. Keep this split when adding new code — user-facing strings and business-rule comments in Portuguese, code identifiers in English.

## Function Design

**Size:** Small, single-purpose functions; service files decompose into private helpers (e.g. `loadAccessibleDocument`, `resolveFavoriteDocuments`) composed by a handful of exported entry points.

**Parameters:** Prefer explicit typed positional params for 2-3 args (`addDocumentFavorite(ctx, user, documentId)`); switch to a single options object for 4+ params or optional flags (`listFavoriteDocuments(user, membershipId?, options?: { excludeArchived?: boolean })`).

**Return Values:** Async service functions return plain typed objects/arrays (no wrapper `Result<T,E>` type) and throw `ServiceError` for failure paths. API handlers return `res.status(...).json(...)` directly rather than a shared response envelope helper (though `server/utils/apiHttp.ts` provides some shared helpers like `apiCreated`, `createdResponse`).

## Module Design

**Exports:** Named exports throughout (no default exports in `server/`/`shared/`/most of `src/`) — exception: API route handler files (`api/**/*.ts`) use `export default async function handler(...)`, matching Vercel serverless function conventions.

**Barrel Files:** Not used broadly; imports reference concrete file paths directly (e.g. `../../../server/services/favorites/documentFavoritesService.ts` rather than an index re-export). When adding a new module in `server/services/<domain>/`, follow existing folders (`server/services/favorites/`, `server/services/sharing/`, `server/services/tracking/`) — one file per concern, imported directly by API handlers and other services.

## Domain/Architecture-Specific Conventions

- **Tenancy is pervasive**: almost every server-side data access function takes/threads a `tenantId`, `ctx: DocumentRequestContext`, or `TenantStorageContext`, and filters Mongo queries with `tenantScopeFilterFromContext(storage)`. New server code touching documents must accept and apply tenant scope — do not query `documents` collections without it.
- **Access control checks precede mutation**: read-then-authorize-then-write pattern — load the document, call `canUserListDocumentWithShare(...)` (or similar), throw `ServiceError` with `403`/`404` before performing the write.
- **Soft delete via `deletedAt`**: query filters consistently use `{ deletedAt: { $exists: false } }` / `{ deletedAt: null }` alternation rather than a boolean flag; new collections should follow the same soft-delete filter shape.
- **Audit/tracking side effects**: mutating API handlers call `emitTrackingEvent(auditCtx, { action, description, ...metadata }, req)` after a successful write, using `sanitizeAuditMetadata(...)` to scrub metadata before persisting — follow this pattern for any new state-changing endpoint.

---

*Convention analysis: 2026-07-15*
