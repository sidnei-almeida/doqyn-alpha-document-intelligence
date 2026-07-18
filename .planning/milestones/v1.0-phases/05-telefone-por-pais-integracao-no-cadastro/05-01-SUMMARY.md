---
phase: 05-telefone-por-pais-integracao-no-cadastro
plan: 01
subsystem: identifiers
tags: [phone, e164, i18n, br, py, us, node-test]

# Dependency graph
requires:
  - phase: 04-identificadores-por-pais
    provides: CountryCode type, defaultCountryForLocale, tenant-agnostic identifier registry pattern
provides:
  - "Country-aware phone.ts registry (PHONE_COUNTRIES) for BR/PY/US"
  - "formatPhone/toE164/toE164Plus/isCompletePhone/defaultPhoneCountry pure functions"
  - "formatBrazilianPhone now exported from whatsapp.ts for cross-module reuse"
affects: [05-02 (PhoneInput component), 05-03 (server contactNormalize generalization), signup forms]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-country phone spec registry (dialCode/placeholder/nationalLengths/format) mirroring the Phase 4 COUNTRY_IDENTIFIERS shape"
    - "BR formatting delegates to the pre-existing formatBrazilianPhone rather than reimplementing BR grouping logic"

key-files:
  created:
    - src/lib/identifiers/phone.ts
    - tests/phone-country.test.ts
  modified:
    - src/lib/identifiers/whatsapp.ts
    - src/lib/identifiers/index.ts

key-decisions:
  - "formatBrazilianPhone made an additive export (no behavior change) instead of duplicating BR grouping logic in phone.ts"
  - "National-digit stripping (nationalDigitsFor) treats input as already-national when it doesn't start with the country's dial code, matching plan's toE164 spec"
  - "PY/US format() partial-input degradation implemented as private helpers (formatParaguayanPhone/formatAmericanPhone) local to phone.ts, not exported"

patterns-established:
  - "Country phone specs are pure objects with a format(nationalDigits) closure; toE164/isCompletePhone derive national digits once via a shared internal helper"

requirements-completed: [TEL-01]

# Metrics
duration: 8min
completed: 2026-07-17
---

# Phase 5 Plan 1: Country-aware phone registry (BR/PY/US) Summary

**Country-aware `phone.ts` registry delivering BR/PY/US phone formatting, E.164 conversion, and completeness checks, reusing `formatBrazilianPhone` for byte-identical BR output.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-17T23:08:02Z
- **Completed:** 2026-07-17T23:16:00Z
- **Tasks:** 2 completed
- **Files modified:** 4 (1 created module, 1 created test, 2 additive edits)

## Accomplishments
- New `src/lib/identifiers/phone.ts` exporting `PHONE_COUNTRIES` (BR/PY/US), `formatPhone`, `toE164`, `toE164Plus`, `isCompletePhone`, `defaultPhoneCountry`
- BR path reuses the now-exported `formatBrazilianPhone` from `whatsapp.ts`, guaranteeing byte-identical BR wire format
- PY (9-digit mobile, 3-3-3 grouping) and US (10-digit, `(AAA) BBB-CCCC`) formatting implemented with graceful partial-input degradation
- Full test coverage in `tests/phone-country.test.ts` (11 assertions across BR/PY/US/regression/locale-default), all green
- `whatsapp.ts`'s 14 existing callers verified unaffected (`tests/identifier-formatters.test.ts` still passes 16/16)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create country-aware phone.ts registry and export formatBrazilianPhone** - `66309a3` (feat)
2. **Task 2: Test phone.ts across BR/PY/US with concrete examples and BR regression** - `91c85bf` (test)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `src/lib/identifiers/phone.ts` - PHONE_COUNTRIES registry + formatPhone/toE164/toE164Plus/isCompletePhone/defaultPhoneCountry
- `src/lib/identifiers/whatsapp.ts` - added `export` keyword to `formatBrazilianPhone` (only change; no behavior change)
- `src/lib/identifiers/index.ts` - added `export * from './phone'` barrel re-export
- `tests/phone-country.test.ts` - BR/PY/US coverage + BR regression + defaultPhoneCountry locale mapping

## Decisions Made
- Reused `formatBrazilianPhone` verbatim for BR instead of reimplementing BR grouping logic in `phone.ts`, per plan instruction, to guarantee zero drift from the existing 14-caller BR behavior.
- `nationalDigitsFor` (private helper) strips a leading dial code only when present; this single helper backs both `toE164`'s national-digit derivation needs (inlined separately per spec) and `formatPhone`/`isCompletePhone`.
- Kept `PhoneCountrySpec` and `PHONE_COUNTRIES` as the only new exported symbols beyond the five functions — no re-export collisions with `whatsapp.ts` or `countryIdentifiers.ts`.

## Deviations from Plan

None - plan executed exactly as written. Task ordering (implementation in Task 1, dedicated test file in Task 2) follows the plan's own explicit task split rather than a strict test-first RED/GREEN cycle within Task 1; this matches the plan's authored structure (Task 1's `<verify>` step is a `tsc` compile check, not a test run, and Task 2 is the dedicated test-authoring task).

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `phone.ts` is ready for consumption by the `PhoneInput` component (plan 05-02) and by `server/utils/contactNormalize.ts` generalization (plan covering TEL-03).
- BR regression test locks the exact wire format (`5554999999999` / `+55 54 99999-9999`) so downstream work can rely on it not silently drifting.
- No blockers identified.

---
*Phase: 05-telefone-por-pais-integracao-no-cadastro*
*Completed: 2026-07-17*

## Self-Check: PASSED

- FOUND: src/lib/identifiers/phone.ts
- FOUND: tests/phone-country.test.ts
- FOUND: src/lib/identifiers/whatsapp.ts
- FOUND: src/lib/identifiers/index.ts
- FOUND: commit 66309a3 (Task 1)
- FOUND: commit 91c85bf (Task 2)
