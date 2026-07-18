# Deferred Items — Phase 01 (Fundação i18n + detecção de locale)

## Pre-existing test failures (out of scope for 01-01)

`npm test` (full suite) reports 21 failing tests unrelated to i18n locale detection.
These failures are caused by uncommitted work already present on `feat/document-chat`
before plan 01-01 execution began (dashboard redesign, document chat, sharing/thumbnail
cache changes — see `git status` at session start). They existed prior to this plan's
changes and are outside 01-01's file scope (`package.json`, `package-lock.json`,
`tsconfig.app.json`, `src/i18n/config.ts`, `tests/i18n-locale-detection.test.ts`).

Per the executor scope boundary rule, these are logged here rather than auto-fixed.

Affected test files (non-exhaustive, from `npm test` output on 2026-07-17):
- `tests/tenant-no-default-groups.test.ts`
- `tests/thumbnail-cache.test.ts`
- `tests/library-selection.test.ts`
- `tests/dashboard-overview.test.ts`
- `tests/document-favorites.test.ts`
- (plus ~16 others touching sharing, OCR pipeline, users page, dev-server routes)

The dedicated `tests/i18n-locale-detection.test.ts` (7/7 assertions) passes in isolation
and does not regress any of the above.
