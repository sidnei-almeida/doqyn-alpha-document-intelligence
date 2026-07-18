---
phase: 03-formata-o-sens-vel-a-locale
plan: 03
subsystem: i18n
tags: [i18n, intl, locale-compare, date-formatting, react]

# Dependency graph
requires:
  - phase: 03-formata-o-sens-vel-a-locale (plan 01)
    provides: Central formatLocale module (formatDate, formatDateTime, localeCompareActive) — byte-identical pt-BR delegation
provides:
  - Library document sort (name/status/owner/category) now compares via the active i18n locale instead of a hardcoded 'pt-BR'
  - Signature and external-share date displays (assigned panel, summary text, public portals) now format via the central formatDate/formatDateTime
  - Migration guard test locking both the localeCompareActive usage and the absence of hardcoded pt-BR formatting/compare across the cluster
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sort comparators call localeCompareActive(a, b) (no locale param) so ordering follows the active i18n locale, same pattern as formatDate/formatDateTime defaulting to getActiveLocale()"

key-files:
  created:
    - tests/format-locale-migration-signature.test.ts
  modified:
    - src/features/library/utils/sortDocuments.ts
    - src/features/signature/components/SignaturesAssignedPanel.tsx
    - src/features/signature/utils/signatureSummaryDisplay.ts
    - src/features/signature/SignaturePortalPage.tsx
    - src/features/signature/InternalSignaturePage.tsx
    - src/features/external-share/ExternalSharePortalPage.tsx

key-decisions:
  - "sortDocuments keeps its existing signature (no locale parameter) — localeCompareActive resolves the active locale internally at call time, per CONTEXT discretion for library sort"
  - "Public portal pages (SignaturePortalPage, InternalSignaturePage, ExternalSharePortalPage) keep their module-scope formatDate/formatShareDate helpers reading the active locale from the i18n singleton, acceptable per CONTEXT discretion for public portals"

patterns-established:
  - "Migration guard tests per plan/cluster (format-locale-migration-*.test.ts) assert both the formatLocale import and the absence of hardcoded pt-BR substrings, extended here to also assert absence of a hardcoded localeCompare(..., 'pt-BR') argument"

requirements-completed: [FMT-01, FMT-02, FMT-03]

# Metrics
duration: 20min
completed: 2026-07-17
---

# Phase 3 Plan 3: Library sort and signature/external-share formatting migration Summary

**Migrated the last hardcoded `'pt-BR'` usages — 4 `localeCompare` calls in library document sort plus 5 signature/external-share date displays — onto the central `formatLocale` module (`localeCompareActive`/`formatDate`/`formatDateTime`), preserving exact sort operands and Intl options for byte-identical pt-BR output.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-17T22:00:00Z (approx.)
- **Completed:** 2026-07-17T22:20:12Z
- **Tasks:** 3
- **Files modified:** 7 (6 modified, 1 created)

## Accomplishments
- `sortDocuments.ts`'s four sort keys (name, status, owner, category) now call `localeCompareActive(a, b)` instead of `a.localeCompare(b, 'pt-BR')`, with the `factor *` multiply and the `updatedAt` numeric branch left untouched.
- `SignaturesAssignedPanel.tsx` keeps its `if (!iso) return '—'` guard and now calls `formatDateTime(new Date(iso), { day, month, year, hour, minute })`.
- `signatureSummaryDisplay.ts`'s `signatureDetailSummaryText` now calls `formatDate(new Date(latestSignedAt), { day, month, year })` (date-only, 3-field option set).
- `SignaturePortalPage.tsx`, `InternalSignaturePage.tsx`, `ExternalSharePortalPage.tsx` module-scope `formatDate`/`formatShareDate` helpers now call `formatDateTime(new Date(iso), { day, month, year, hour, minute })`, kept module-scope per CONTEXT discretion for public portals.
- New `tests/format-locale-migration-signature.test.ts` (13 assertions) locks the `@/lib/formatLocale` import and absence of hardcoded `toLocale*('pt-BR'` / `Intl.DateTimeFormat('pt-BR'` across all 6 files, plus `localeCompareActive` presence and absence of a hardcoded `'pt-BR')` compare argument in `sortDocuments.ts`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate library sortDocuments localeCompare (x4)** - `373c470` (feat)
2. **Task 2: Migrate signature and external-share date displays** - `9c433b1` (feat)
3. **Task 3: Add migration guard test for this cluster** - `1f3ba45` (test)

**Plan metadata:** _pending_ (docs: complete plan)

## Files Created/Modified
- `src/features/library/utils/sortDocuments.ts` - Four sort comparators (name/status/owner/category) use `localeCompareActive`; imports it from `@/lib/formatLocale`
- `src/features/signature/components/SignaturesAssignedPanel.tsx` - `formatDate` helper delegates to `formatDateTime` with the 5-field option set, keeps `'—'` guard
- `src/features/signature/utils/signatureSummaryDisplay.ts` - `signatureDetailSummaryText` delegates to `formatDate` with the 3-field date-only option set
- `src/features/signature/SignaturePortalPage.tsx` - Module-scope `formatDate` delegates to `formatDateTime` with the 5-field option set
- `src/features/signature/InternalSignaturePage.tsx` - Module-scope `formatDate` delegates to `formatDateTime` with the 5-field option set
- `src/features/external-share/ExternalSharePortalPage.tsx` - Module-scope `formatShareDate` delegates to `formatDateTime` with the 5-field option set
- `tests/format-locale-migration-signature.test.ts` - Migration guard: formatLocale import + absence of hardcoded pt-BR formatting/compare across all 6 files

## Decisions Made
- Kept `sortDocuments` and the public portal `formatDate`/`formatShareDate` helpers at module scope with no explicit locale parameter — they resolve the active locale internally via `getActiveLocale()` inside `localeCompareActive`/`formatDateTime`, matching the CONTEXT discretion notes for library sort and public portals.
- Extended the guard-test pattern from `format-locale-migration-send.test.ts` with an extra assertion specific to this cluster: `sortDocuments.ts` must not contain a hardcoded `'pt-BR')` locale-compare argument (checked as `source.includes("'pt-BR')")` rather than the broader/riskier combined check flagged in the plan as "too broad").

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All hardcoded `'pt-BR'` formatting/compare call sites identified across plans 03-01/03-02/03-03 are now migrated onto the central `formatLocale` module.
- Full test suite run (`npx tsx --test tests/**/*.test.ts`): 1363 tests, 1341 pass, 22 fail — matching the documented pre-existing baseline (~21-22 failures from unrelated `feat/document-chat` changes); no new failures introduced by this plan.
- TypeScript check (`npx tsc --noEmit -p tsconfig.app.json`) shows no errors in any of the 6 files touched by this plan.

---
*Phase: 03-formata-o-sens-vel-a-locale*
*Completed: 2026-07-17*

## Self-Check: PASSED
All 6 modified/created files verified present on disk; all 3 task commits (373c470, 9c433b1, 1f3ba45) verified present in git log.
