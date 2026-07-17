---
phase: 01-funda-o-i18n-detec-o-de-locale
plan: 01
subsystem: i18n
tags: [i18next, react-i18next, i18next-browser-languagedetector, typescript, node-test]

# Dependency graph
requires: []
provides:
  - "react-i18next, i18next, i18next-browser-languagedetector installed as runtime dependencies"
  - "src/i18n/config.ts exporting SUPPORTED_LOCALES, DEFAULT_LOCALE, SupportedLocale, resolveSupportedLocale()"
  - "resolveJsonModule enabled in tsconfig.app.json for downstream JSON catalog imports"
  - "Locked es/en/pt -> es-PY/en-US/pt-BR detection mapping, unit-tested"
affects: [01-02, 01-03]

# Tech tracking
tech-stack:
  added: [react-i18next, i18next, i18next-browser-languagedetector]
  patterns:
    - "DOM-free pure detection function (resolveSupportedLocale) — no navigator/document access inside src/i18n/config.ts; callers supply the language list"

key-files:
  created:
    - src/i18n/config.ts
    - tests/i18n-locale-detection.test.ts
  modified:
    - package.json
    - package-lock.json
    - tsconfig.app.json

key-decisions:
  - "Supply-chain gate for the three i18next packages was pre-approved by the operator (official, de-facto-standard packages) — no blocking checkpoint needed."
  - "Detection mapping matches by primary subtag of the FIRST recognized tag in the caller-supplied language list, case-insensitively, falling back to pt-BR for anything unrecognized or empty."

patterns-established:
  - "i18n locale constants and detection logic live in src/i18n/config.ts, kept pure/DOM-free so it can be unit-tested without jsdom."

requirements-completed: [I18N-03]
requirements-partial:
  - id: I18N-01
    note: "Runtime installed (react-i18next/i18next/i18next-browser-languagedetector); LocaleProvider wiring is 01-02/01-03 scope, not yet done."
  - id: I18N-02
    note: "Locale constants exported as the foundation; JSON catalogs themselves are 01-02 scope, not yet created."

# Metrics
duration: 6min
completed: 2026-07-17
---

# Phase 01 Plan 01: Fundação i18n — dependências e detecção de locale Summary

**Installed react-i18next/i18next/i18next-browser-languagedetector and added a DOM-free `resolveSupportedLocale()` mapping (es/en/pt -> es-PY/en-US/pt-BR, pt-BR fallback), unit-tested with 7 passing assertions.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-17T17:31:37Z
- **Completed:** 2026-07-17T17:36:00Z
- **Tasks:** 3 (1 no-op supply-chain acknowledgment + 2 code tasks)
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- i18n runtime dependencies (`react-i18next`, `i18next`, `i18next-browser-languagedetector`) installed and resolving via `npm ls`
- `src/i18n/config.ts` created with `SUPPORTED_LOCALES`, `DEFAULT_LOCALE`, `SupportedLocale`, and the pure `resolveSupportedLocale()` detection helper implementing the locked I18N-03 mapping
- `resolveJsonModule: true` added to `tsconfig.app.json` compiler options, unblocking JSON catalog imports for plan 01-02
- `tests/i18n-locale-detection.test.ts` added with 7 passing assertions covering es/en/pt/unknown/empty/precedence/case-insensitivity, run via `npx tsx --test`

## Task Commits

Each task was committed atomically:

1. **Task 1: Supply-chain note (pre-approved)** - no-op, no commit (documented in Task 2's commit message)
2. **Task 2: Install i18n deps, add config constants + detection helper, enable JSON imports** - `c53c2e5` (feat)
3. **Task 3: Unit-test the locale detection mapping** - `877ff60` (test)

**Plan metadata:** (this commit, docs)

## Files Created/Modified
- `src/i18n/config.ts` - `SUPPORTED_LOCALES` tuple, `DEFAULT_LOCALE`, `SupportedLocale` type, `resolveSupportedLocale()` pure detection function
- `tests/i18n-locale-detection.test.ts` - node:test unit coverage of the detection mapping (7 assertions)
- `package.json` / `package-lock.json` - added `react-i18next`, `i18next`, `i18next-browser-languagedetector` to `dependencies`
- `tsconfig.app.json` - added `"resolveJsonModule": true` to `compilerOptions`

## Decisions Made
- None beyond what was locked in the plan/context — implementation followed the specified mapping exactly (first-recognized-tag wins, case-insensitive primary subtag match, pt-BR fallback).

## Deviations from Plan

None - plan executed exactly as written. Task 1 was a documented no-op per the plan's own instructions (supply-chain verification pre-approved by the operator); its acknowledgment was folded into Task 2's commit message rather than producing an empty commit.

## Issues Encountered

None specific to this plan's scope. The working tree already carried substantial unrelated uncommitted work from an in-progress `feat/document-chat` branch (dashboard redesign, document chat feature, sharing/thumbnail-cache changes) present before this plan started executing. That pre-existing state causes 21 unrelated test failures in the full `npm test` run and several pre-existing lint errors in unrelated files — none touch `src/i18n/**` or `tests/i18n-locale-detection.test.ts`, and none were introduced by this plan. Logged in `.planning/phases/01-funda-o-i18n-detec-o-de-locale/deferred-items.md` per the executor scope-boundary rule (out of scope for 01-01, not auto-fixed).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `src/i18n/config.ts` constants and `resolveSupportedLocale()` are ready for plan 01-02 to build the i18next `init()` call and JSON catalogs on top of.
- `resolveJsonModule` is enabled so plan 01-02's JSON catalog imports will type-check under `tsc -b`.
- Pre-existing unrelated test/lint failures (see Issues Encountered) remain outstanding on the branch and are not part of this plan's scope; they should be addressed separately from i18n work.

---
*Phase: 01-funda-o-i18n-detec-o-de-locale*
*Completed: 2026-07-17*

## Self-Check: PASSED

- FOUND: src/i18n/config.ts
- FOUND: tests/i18n-locale-detection.test.ts
- FOUND: .planning/phases/01-funda-o-i18n-detec-o-de-locale/01-01-SUMMARY.md
- FOUND commit: c53c2e5
- FOUND commit: 877ff60
