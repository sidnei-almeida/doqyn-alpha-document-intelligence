---
phase: 01-funda-o-i18n-detec-o-de-locale
plan: 02
subsystem: i18n
tags: [i18next, react-i18next, json-catalogs, node-test]

# Dependency graph
requires:
  - phase: 01-funda-o-i18n-detec-o-de-locale (plan 01)
    provides: "src/i18n/config.ts (SUPPORTED_LOCALES, DEFAULT_LOCALE, resolveSupportedLocale) and resolveJsonModule tsconfig support"
provides:
  - "common/nav JSON catalogs for pt-BR, es-PY, en-US under src/i18n/locales/<locale>/<namespace>.json"
  - "src/i18n/index.ts — configured i18next singleton (initReactI18next, resources, fallbackLng pt-BR, detection-driven initial lng)"
  - "Catalog parity + pt-BR anchoring test (tests/i18n-catalogs.test.ts)"
affects: [01-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Flat-key JSON catalogs per locale/namespace (src/i18n/locales/<locale>/<namespace>.json), pt-BR as source of truth"
    - "i18next singleton guarded by isInitialized to avoid double-init on HMR/re-import"

key-files:
  created:
    - src/i18n/locales/pt-BR/common.json
    - src/i18n/locales/pt-BR/nav.json
    - src/i18n/locales/es-PY/common.json
    - src/i18n/locales/es-PY/nav.json
    - src/i18n/locales/en-US/common.json
    - src/i18n/locales/en-US/nav.json
    - src/i18n/index.ts
    - tests/i18n-catalogs.test.ts
  modified: []

key-decisions:
  - "Relative imports in src/i18n/index.ts use no explicit extension (e.g. './config'), matching existing src/ frontend convention — the .js-extension rule in CLAUDE.md applies to server/api code, not src/ frontend modules."
  - "Detection languages read from navigator.languages with a defensive guard (typeof navigator !== 'undefined'); falls back to DEFAULT_LOCALE when unavailable or empty, keeping resolveSupportedLocale itself DOM-free per 01-01's established pattern."

patterns-established:
  - "Catalog JSON parity enforced by an automated test comparing sorted key sets across locales, plus a non-empty-value check and a handful of pt-BR anchor assertions."

requirements-completed: [I18N-02, I18N-03]

# Metrics
duration: 8min
completed: 2026-07-17
---

# Phase 01 Plan 02: Catálogos de mensagens e inicialização do i18next Summary

**Six flat-key JSON catalogs (pt-BR/es-PY/en-US x common/nav) plus a single i18next singleton initialized with pt-BR fallback and detection-driven initial language via `resolveSupportedLocale(navigator.languages)`.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-17T17:38:00Z
- **Completed:** 2026-07-17T17:46:00Z
- **Tasks:** 3
- **Files modified:** 8 (all created)

## Accomplishments
- 14 nav keys + 8 common keys authored for pt-BR (anchored to existing shell/nav UI strings), es-PY (Paraguay Spanish), and en-US, with identical key sets across all three locales
- `src/i18n/index.ts` initializes `i18next.use(initReactI18next).init(...)` once with the composed `resources` map, `fallbackLng: 'pt-BR'`, `defaultNS: 'common'`, `ns: ['common', 'nav']`, `supportedLngs` from `SUPPORTED_LOCALES`, and initial `lng` resolved through `resolveSupportedLocale`
- Catalog parity/fallback test (`tests/i18n-catalogs.test.ts`) with 6 assertions: identical key sets per namespace, no empty values, pt-BR anchor values match current UI strings

## Task Commits

Each task was committed atomically:

1. **Task 1: Author common + nav catalogs for pt-BR, es-PY, en-US** - `c5b01eb` (feat)
2. **Task 2: Initialize i18next against the catalogs** - `dcd4bd0` (feat)
3. **Task 3: Catalog parity + fallback test** - `4ea7554` (test)

**Plan metadata:** (this commit, docs)

## Files Created/Modified
- `src/i18n/locales/pt-BR/{common,nav}.json` - Portuguese catalogs, source of truth for values
- `src/i18n/locales/es-PY/{common,nav}.json` - Paraguay Spanish translations, same key set
- `src/i18n/locales/en-US/{common,nav}.json` - US English translations, same key set
- `src/i18n/index.ts` - Configured i18next singleton (resources, fallbackLng, detection-driven initial lng)
- `tests/i18n-catalogs.test.ts` - node:test parity/fallback coverage for the six catalogs

## Decisions Made
- Followed CLAUDE.md's frontend import convention (no explicit `.js` extension on the `./config` relative import in `src/i18n/index.ts`) rather than the server/api `.js`-extension convention, since `src/i18n/index.ts` is a frontend module — confirmed by grepping existing `src/` relative imports for the pattern.
- Guarded `navigator.languages` access with a `typeof navigator !== 'undefined'` check before calling `resolveSupportedLocale`, keeping the detection helper itself untouched (still DOM-free, as established in 01-01) while making the init module resilient to non-browser environments (e.g. tests, SSR-style tooling).

## Deviations from Plan

None - plan executed exactly as written. All six catalogs, the i18next init module, and the parity test match the plan's task specs and acceptance criteria.

## Issues Encountered

`npm run build` (`tsc -b`) fails with exit code 2 due to 3 pre-existing TypeScript errors in unrelated files not touched by this plan (`src/features/document-update-version/utils/documentMetadataDisplay.ts:35`, `server/services/confirmAnalysisService.ts:46-47` — all `TS6133: declared but never read`). Verified these are baseline/pre-existing by temporarily stashing this plan's new `src/i18n/index.ts` and re-running the build: identical 3 errors, identical exit code 2, confirming they predate and are unrelated to this plan's i18n work. No errors were reported in any `src/i18n/**` file. Per the executor scope-boundary rule, these are out of scope and were not fixed. `npm test` shows 21 pre-existing failures (same count reported by 01-01), none in `src/i18n/**` or `tests/i18n-catalogs.test.ts`; all 6 new i18n-catalog tests pass, and no new failures were introduced in files touched by this plan. `npx eslint` on all newly created files (`src/i18n/index.ts`, `src/i18n/config.ts`, `tests/i18n-catalogs.test.ts`) reports zero issues.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `src/i18n/index.ts` exports a configured `i18n` singleton ready for plan 01-03 to wrap the app with `I18nextProvider` (or `initReactI18next` consumers) and migrate shell/nav components to `t()` calls against the `common`/`nav` namespaces.
- Catalog key set (14 nav + 8 common) is locked and parity-tested; plan 01-03 should not introduce new keys without updating all three locale files and the parity test.
- Pre-existing baseline TS build errors (2 files, unrelated to i18n) and 21 pre-existing test failures remain outstanding on the branch — not part of this plan's scope, should be addressed separately from i18n work (same note as 01-01-SUMMARY.md).

---
*Phase: 01-funda-o-i18n-detec-o-de-locale*
*Completed: 2026-07-17*

## Self-Check: PASSED

- FOUND: src/i18n/locales/pt-BR/common.json
- FOUND: src/i18n/locales/pt-BR/nav.json
- FOUND: src/i18n/locales/es-PY/common.json
- FOUND: src/i18n/locales/es-PY/nav.json
- FOUND: src/i18n/locales/en-US/common.json
- FOUND: src/i18n/locales/en-US/nav.json
- FOUND: src/i18n/index.ts
- FOUND: tests/i18n-catalogs.test.ts
- FOUND commit: c5b01eb
- FOUND commit: dcd4bd0
- FOUND commit: 4ea7554
