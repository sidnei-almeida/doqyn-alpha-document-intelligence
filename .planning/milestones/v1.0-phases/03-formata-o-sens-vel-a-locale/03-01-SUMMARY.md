---
phase: 03-formata-o-sens-vel-a-locale
plan: 01
subsystem: i18n
tags: [i18n, intl, react-i18next, date-formatting, number-formatting, locale]

# Dependency graph
requires:
  - phase: 02-selecao-e-persistencia-de-idioma
    provides: i18n singleton (src/i18n/index.ts), SUPPORTED_LOCALES/DEFAULT_LOCALE (src/i18n/config.ts), useLocale hook pattern
provides:
  - Central locale-aware formatting module (src/lib/formatLocale.ts) — getActiveLocale, formatDate, formatDateTime, formatTime, formatNumber, localeCompareActive
  - useLocaleFormatters React hook binding formatters to the active locale with re-render on language switch
  - src/lib/utils.ts formatDate delegating to the central module (pt-BR output byte-identical)
affects: [03-02, 03-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Locale-aware formatting: resolve locale via getActiveLocale() (validated against SUPPORTED_LOCALES, falls back to DEFAULT_LOCALE), never hardcode 'pt-BR'"
    - "Byte-identity rule: when Intl options are omitted, delegate to the native toLocale*(locale) method instead of an unconditional Intl.DateTimeFormat, to avoid silently changing output shape (e.g. adding time to a date-only call)"

key-files:
  created:
    - src/lib/formatLocale.ts
    - src/lib/useLocaleFormatters.ts
    - tests/format-locale.test.ts
  modified:
    - src/lib/utils.ts
    - tsconfig.json

key-decisions:
  - "getActiveLocale validates i18n.language against SUPPORTED_LOCALES and falls back to DEFAULT_LOCALE (pt-BR) for any unexpected value (T-03-01 mitigation)"
  - "Date/time formatters delegate to native toLocale*(locale) when opts is omitted (byte-identity), and to Intl.DateTimeFormat(locale, opts) when opts is provided"
  - "utils.ts formatDate now delegates to formatDateTime with the identical option set it always used, dropping the hardcoded 'pt-BR' literal without changing pt-BR output"
  - "Rule 3 fix: added baseUrl/paths to root tsconfig.json so tsx (npm test / npx tsx --test) resolves '@/*' aliases at runtime — previously only tsconfig.app.json/tsconfig.server.json declared paths, which vite/tsc project-references honor but tsx's tsconfig auto-discovery (nearest tsconfig.json by directory walk-up) did not; this is required for the plan's own '@/i18n' import convention to work under the test runner"

patterns-established:
  - "Formatters accept an optional trailing `locale?: SupportedLocale` argument for deterministic tests/explicit-locale call sites, defaulting to getActiveLocale() when omitted"

requirements-completed: [FMT-01, FMT-02]

# Metrics
duration: 15min
completed: 2026-07-17
---

# Phase 3 Plan 1: Central locale-aware formatting module Summary

**Added `formatLocale.ts` + `useLocaleFormatters` hook reading the active i18n locale via `getActiveLocale()`, with `utils.ts formatDate` now delegating to it while staying byte-identical in pt-BR.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-17T18:17:00Z (approx.)
- **Completed:** 2026-07-17T18:32:17Z
- **Tasks:** 3
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments
- Central `src/lib/formatLocale.ts` exporting `getActiveLocale`, `formatDate`, `formatDateTime`, `formatTime`, `formatNumber`, `localeCompareActive` — all locale-resolved via the active i18n locale, never a hardcoded literal.
- `useLocaleFormatters()` hook binds those formatters to the active locale and re-renders on `languageChanged` via `useTranslation()`.
- `src/lib/utils.ts formatDate` delegates to `formatDateTime` with the identical `{day,month,year,hour,minute}` option set, preserving pt-BR output while dropping the `'pt-BR'` literal; `formatFileSize` untouched.
- 11 new tests in `tests/format-locale.test.ts` lock pt-BR byte-identity (with and without explicit opts), es-PY/en-US formatting, `localeCompareActive` ordering, and the `getActiveLocale` fallback for unsupported `i18n.language` values.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create central formatLocale module** - `17e9786` (feat)
2. **Task 2: Add useLocaleFormatters hook and delegate utils.ts formatDate** - `2c0b548` (feat)
3. **Task 3: Lock behavior with tests (pt-BR identity, es-PY/en-US, fallback)** - `790c986` (test)

**Plan metadata:** _pending_ (docs: complete plan)

## Files Created/Modified
- `src/lib/formatLocale.ts` - Central locale-aware formatters (getActiveLocale + date/number/compare functions)
- `src/lib/useLocaleFormatters.ts` - React hook binding formatters to the active locale, re-derives on languageChanged
- `src/lib/utils.ts` - `formatDate` now delegates to `formatDateTime`; `formatFileSize` unchanged
- `tsconfig.json` - Added `baseUrl`/`paths` so `@/*` resolves under `tsx`/`npx tsx --test` (build graph via project references unaffected)
- `tests/format-locale.test.ts` - 11 tests locking byte-identity, multi-locale formatting, and fallback behavior

## Decisions Made
- Formatters resolve locale as `locale ?? getActiveLocale()`, keeping call sites free to force a specific locale (used heavily by the new tests) while defaulting to the active i18n locale in real usage.
- Kept the byte-identity branch (`opts === undefined` → native `toLocale*`) exactly as specified in the plan to avoid any output-shape change for existing pt-BR call sites.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Root tsconfig.json missing `paths`, breaking `@/*` resolution under `tsx`**
- **Found during:** Task 1 (verifying `npx tsx -e "import('./src/lib/formatLocale.ts')..."` per the plan's own automated verify command)
- **Issue:** `formatLocale.ts` imports `i18n from '@/i18n'` and config from `@/i18n/config'` per the plan's required import convention. `tsconfig.app.json` and `tsconfig.server.json` both declare `paths` for `@/*`/`@shared/*`/`@server/*`, but the root `tsconfig.json` (a solution-style file with only `references`) has none. `tsx`'s tsconfig auto-discovery walks up from the file being resolved to the nearest `tsconfig.json` and does not follow project `references` to pick up child `paths` — so `npx tsx --test` (used by `npm test` and this plan's own verify commands) failed with `ERR_MODULE_NOT_FOUND` for `@/i18n`.
- **Fix:** Added `compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"], "@shared/*": ["./shared/*"] } }` to root `tsconfig.json`, mirroring `tsconfig.app.json`'s existing mapping.
- **Files modified:** `tsconfig.json`
- **Verification:** `npx tsx -e "import('./src/lib/formatLocale.ts')..."` now resolves and prints `exports ok`; `npx tsc --build tsconfig.json --dry` still shows the same 3-project build graph (root has no `files`/`include`, so nothing is compiled from it directly — the change is inert for `tsc --build`); full `npx tsx --test tests/**/*.test.ts` shows the same pre-existing baseline failure count (21, within the documented ~22) with no new failures.
- **Committed in:** `17e9786` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking build-config fix)
**Impact on plan:** Required for the plan's own mandated `@/i18n` import convention to work under the Node test runner (`npx tsx --test`, which is how `npm test` and this plan's verify commands run). No scope creep — root tsconfig changes are additive and inert to the existing `tsc --build` project-reference graph.

## Issues Encountered
None beyond the tsconfig blocking issue documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `formatLocale.ts` and `useLocaleFormatters` are ready for plans 03-02/03-03 to migrate remaining hardcoded `'pt-BR'` formatting call sites onto.
- pt-BR output is proven byte-identical, so migration in 03-02/03-03 should be a drop-in replacement wherever the same option sets are reused.

---
*Phase: 03-formata-o-sens-vel-a-locale*
*Completed: 2026-07-17*

## Self-Check: PASSED
