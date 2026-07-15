# Testing Patterns

**Analysis Date:** 2026-07-15

## Test Framework

**Runner:**
- Node.js built-in test runner (`node:test`), executed through `tsx` for TypeScript support
- No config file — invoked directly via the npm script
- 149 test files, all flat under `tests/` (no nesting), totaling ~18,100 lines

**Assertion Library:**
- `node:assert/strict` (`assert.equal`, `assert.ok`, `assert.deepEqual`, `assert.match`, `assert.rejects`)

**Run Commands:**
```bash
npm test                              # runs: tsx --test tests/**/*.test.ts (all tests)
npx tsx --test tests/document-favorites.test.ts   # run a single file
npx tsx --test --watch tests/**/*.test.ts         # watch mode (node:test built-in flag)
```
There is no separate coverage command configured in `package.json`; `node --test --experimental-test-coverage` can be used ad hoc but is not wired into scripts.

**Note on the related `doqyn-auth-service` repo:** that service uses **Vitest** (`vitest run` / `vitest`), a different runner from this repo's `node:test`. Do not assume Vitest APIs (`vi.fn()`, `vi.mock()`) work here — this repo's mocking is done via `node:test`'s built-in `mock` import (see Mocking below) or plain hand-rolled fakes.

## Test File Organization

**Location:**
- All tests live in a single flat `tests/` directory at the repo root — NOT co-located with source files.
- No subdirectories, no `__tests__` folders inside `src/`/`server/`/`api/`.

**Naming:**
- `kebab-case.test.ts`, named after the feature/behavior under test rather than mirroring a single source file — e.g. `tests/document-favorites.test.ts` covers Mongo schema, service, API handlers, AND frontend hooks/components for the "favorites" feature end-to-end in one file.
- Many files are explicitly phase/audit-oriented rather than unit-oriented: `tests/phase-a-foundation.test.ts`, `tests/phase-b-vision-cascade.test.ts`, `tests/audit-*`, `tests/governance-*` — these read like acceptance checklists for specific project phases/migrations.

**Structure:**
```
tests/
  document-favorites.test.ts       # feature test spanning DB schema + service + API + frontend
  http-client.test.ts              # pure unit test of a small utility module
  metadata-key-normalize.test.ts   # unit tests + one integration-style test combining two modules
  r2-storage.test.ts               # unit tests with hand-rolled S3Client mocks
  phase-b-*.test.ts                # infra/migration phase verification tests
  ...
```

## Test Structure

**Suite Organization (typical shape):**
```typescript
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { functionUnderTest } from '../src/some/module.ts';

describe('featureName — short description', () => {
  it('specific behavior in plain language (often Portuguese)', () => {
    const result = functionUnderTest(/* ... */);
    assert.equal(result, expected);
  });
});
```
- `describe` block titles and `it` descriptions are written as readable sentences, frequently in Portuguese, describing the behavior/invariant being verified (e.g. `'badge de favorito respeita escopo do usuário logado'`).
- Multiple `describe` blocks per file are common when a feature spans layers (backend schema/service/API in one `describe`, frontend hooks/components in another) — see `tests/document-favorites.test.ts`.
- `beforeEach`/`afterEach` used (45 occurrences across the suite) for per-test setup/teardown, mainly in tests that install `mock` fakes or reset module-level caches (e.g. `resetStorageProviderCache()` in `tests/r2-storage.test.ts`).

## Mocking

**Framework:** `node:test`'s built-in `mock` helper (imported alongside `describe`/`it`) — no Jest/Sinon/Vitest mocking library.

**Patterns:**
```typescript
import { describe, it, beforeEach, afterEach, mock } from 'node:test';

// Hand-rolled fake for an SDK client (no library mock needed):
function createMockClient(handler: (command: unknown) => Promise<unknown>): S3Client {
  return { send: handler } as unknown as S3Client;
}

// node:test's mock.fn() for call-count assertions:
assert.equal(ensureBucket.mock.calls.length, 1);
```
- For AWS SDK / MongoDB-style clients, tests build a minimal fake object matching only the shape used by the code under test, cast with `as unknown as RealType` — do not pull in a full SDK mock library.
- For business-rule/service code, a large share of tests (97 of 149 files) instead **read source files as raw text** with `node:fs`'s `readFileSync` and assert on substring/pattern presence rather than executing the code:
```typescript
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
function read(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

it('service valida acesso antes de favoritar e não usa Postgres/auth-service', () => {
  const service = read('server/services/favorites/documentFavoritesService.ts');
  assert.ok(service.includes('canUserListDocument'));
  assert.equal(service.includes('prisma'), false);
  assert.equal(service.includes('auth-service'), false);
});
```
This "source-grep" pattern is used to (a) verify architectural invariants (e.g. "this module must not import Prisma/auth-service", "this collection index must exist"), and (b) check that specific UI strings/behaviors are wired up across many files, without needing a DOM/React test renderer or a live MongoDB connection. **When adding a similar architectural-invariant test, follow this same `read()` helper + `assert.ok(text.includes(...))` / `assert.equal(text.includes(...), false)` pattern** rather than introducing a new test double library.

**What to Mock:**
- External SDK clients (S3/R2, in `tests/r2-storage.test.ts`) via hand-rolled `{ send: handler }` fakes.
- Nothing is mocked in the source-grep style tests — they read real files, so keep referenced strings/paths in sync when refactoring or these tests will fail.

**What NOT to Mock:**
- Pure utility functions (`shared/metadataKeyNormalize.ts`, `src/lib/queryParams.ts`) are imported and called directly with real inputs — no mocking needed, straightforward input/output assertions.
- No MongoDB test containers or in-memory Mongo — there is no live-DB integration test harness in this suite; Mongo-touching logic is verified either via source-grep (schema/index string checks) or via pure-function extraction (e.g. `attachFavoriteFlags`, `buildVersionComparisonRows` tested with in-memory objects, not real DB calls).

## Fixtures and Factories

**Test Data:**
- No dedicated factory library; test fixtures are inlined as plain object literals per test, often cast with `as unknown as SomeResponseType` to satisfy TypeScript without needing a full valid object:
```typescript
const detail = {
  metadata: { 'Parte Reveladora': '...', 'Data De Assinatura': '2026-06-09' },
  document: { currentFileName: 'NDA.pdf', categoryName: 'Jurídico', version: 1 },
} as unknown as DocumentDetailResponse;
```
- Shared binary/document fixtures for AI/Groq pipeline tests live in `scripts/fixtures/` (used by `scripts/test-groq-fixture.mjs`, `scripts/test-groq-pdf.mjs` — these are standalone smoke-test scripts run via `npm run test:groq:fixture`, separate from the `node:test` suite in `tests/`).

**Location:**
- Inline in test files (`tests/*.test.ts`) for unit-level fixtures.
- `scripts/fixtures/` for binary/PDF fixtures used by Groq smoke-test scripts (not part of `npm test`).

## Coverage

**Requirements:** None enforced/configured. No coverage threshold, no CI coverage gate found in `package.json` or config files.

**View Coverage (ad hoc):**
```bash
node --experimental-test-coverage --test tests/**/*.test.ts
```

## Test Types

**Unit Tests:**
- Pure-function tests (metadata normalization, query param serialization, header logic) — direct import + assert, no I/O. Example: `tests/http-client.test.ts`, `tests/query-params.test.ts`.

**Integration Tests:**
- "Source-grep" architectural tests (majority of the suite) that verify multiple real files agree with each other (DB constants ↔ index definitions ↔ service ↔ API handler ↔ frontend hook ↔ component), without spinning up a server or database. Example: `tests/document-favorites.test.ts`.
- A smaller set of true integration tests exercise real logic across a module boundary with hand-built fakes for external services (e.g. `tests/r2-storage.test.ts` exercising bucket provisioning logic against a fake S3 client).

**E2E Tests:**
- Not used within `npm test`. Standalone smoke-test scripts exist outside the `node:test` suite for exercising live external integrations manually: `scripts/test-groq-smoke.mjs`, `scripts/test-groq-pdf.mjs`, `scripts/r2-smoke-test.ts`, `scripts/test-tenant-isolation.ts` (run via dedicated `npm run test:*` / `npm run r2:smoke` scripts, not part of the default `npm test`).

## Common Patterns

**Async Testing:**
```typescript
it('ensureTenantBucket chama HeadBucket e CreateBucket quando necessário', async () => {
  const commands: unknown[] = [];
  const client = createMockClient(async (command) => {
    commands.push(command);
    // ...
  });
  await ensureTenantBucket(client, /* ... */);
  assert.equal(commands.length, 2);
});
```
- `it('...', async () => { ... })` with `await` on the function under test; no special async helper needed since `node:test` supports returning promises natively.

**Error Testing:**
```typescript
assert.equal(service.includes('prisma'), false);   // negative-presence check (source-grep style)
// or, for real thrown errors:
await assert.rejects(() => someAsyncFn(badInput), /expected message pattern/);
```
- Negative assertions (`assert.equal(x.includes(y), false)`) are the dominant way this codebase guards against regressions/legacy-code reintroduction (e.g. asserting a module does NOT reference `localStorage`, `prisma`, or `auth-service`).

---

*Testing analysis: 2026-07-15*
