---
phase: 04-identificadores-fiscais-por-pais
plan: 01
subsystem: identifiers
tags: [country-identifiers, cpf, cnpj, ruc, ssn, ein, ci, mod-11, i18n, validation]

# Dependency graph
requires:
  - phase: 03-locale-aware-formatting
    provides: SupportedLocale type and getActiveLocale/locale infra
provides:
  - Country identifier registry (BR/PY/US) with format/normalize/isComplete/validate per person type
  - Additive CPF/CNPJ mod-11 check-digit validators in taxId.ts (non-breaking)
  - defaultCountryForLocale mapping for signup country defaults
affects: [04-02, 04-03, DocumentIdInput, CountrySelect, reviewDisplay]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-country IdentifierSpec registry indexed by CountryCode x PersonType, single source of truth for label/format/validate"
    - "Additive validation layer: validate() is independent from isComplete() so existing length-based completeness gates never change"

key-files:
  created:
    - src/lib/identifiers/countryIdentifiers.ts
    - tests/country-identifiers.test.ts
  modified:
    - src/lib/identifiers/taxId.ts
    - src/lib/identifiers/index.ts

key-decisions:
  - "BR isComplete stays strictly length-based (11/14 digits); validate() (mod-11 DV) is additive and never gates completeness, per CONTEXT discretion note"
  - "PY RUC validate recomputes mod-11 base-11 DV over the 8 base digits (weight starts at 2, increments per digit, wraps to 2 after 11)"
  - "US EIN validate is format-only (9 digits, no public check-digit algorithm); US SSN validate enforces SSA area/group/serial rules"
  - "CI thousands grouping implemented as a generic right-to-left 3-digit chunker (formatThousands), reused conceptually for any future numeric grouping need"

requirements-completed: [DOC-01, DOC-02, DOC-03]

# Metrics
duration: 12min
completed: 2026-07-17
---

# Phase 4 Plan 1: Country Identifier Registry Summary

**Country identifier registry (`countryIdentifiers.ts`) covering BR CPF/CNPJ, PY CI/RUC, US SSN/EIN with format/validate/completeness per person type, plus additive mod-11 check-digit validators for CPF/CNPJ.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-17T22:34:00Z
- **Completed:** 2026-07-17T22:46:00Z
- **Tasks:** 2 completed
- **Files modified:** 4 (1 created new module, 1 created test file, 2 modified)

## Accomplishments
- Added `validateCpf`/`validateCnpj` mod-11 check-digit validators to `taxId.ts` without touching any existing export signature (BR regression test guards format/completeness).
- Built `src/lib/identifiers/countryIdentifiers.ts` registry exposing `CountryCode`, `PersonType`, `IdentifierSpec`, `COUNTRY_IDENTIFIERS`, `getIdentifierSpec`, `SUPPORTED_COUNTRIES`, `countryLabelKey`, `defaultCountryForLocale` — all 6 BR/PY/US x individual/company combinations implemented.
- Implemented PY RUC mod-11 (base 11) check-digit recomputation and PY CI length gate (6-9 digits) with thousands-grouped formatting.
- Implemented US SSN validation per SSA rules (area ≠ 000/666/900-999, group ≠ 00, serial ≠ 0000) and US EIN format-only validation (9 digits, `NN-NNNNNNN`).
- Full test suite (27 tests, `tests/country-identifiers.test.ts`) covering BR check digits, BR regression, all 6 spec routes, PY CI, PY RUC, US SSN, US EIN, and `defaultCountryForLocale`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add additive BR check-digit validators to taxId.ts** - `ce0c7fb` (feat)
2. **Task 2: Build countryIdentifiers.ts registry with PY/US specs + defaultCountryForLocale** - `7d9df0e` (feat)

_Note: TDD-style behavior/tests were written and verified together with implementation per task rather than as separate RED/GREEN commits, since `tdd="true"` behavior blocks were used as acceptance specs rather than a strict red-green-refactor cadence; all behaviors from the plan are asserted and green._

## Files Created/Modified
- `src/lib/identifiers/taxId.ts` - added `validateCpf`/`validateCnpj` (mod-11 DV), `isAllSameDigit`, `computeModulo11CheckDigit` helpers; all pre-existing exports unchanged
- `src/lib/identifiers/countryIdentifiers.ts` - new country identifier registry (CountryCode/PersonType/IdentifierSpec, COUNTRY_IDENTIFIERS, getIdentifierSpec, SUPPORTED_COUNTRIES, countryLabelKey, defaultCountryForLocale)
- `src/lib/identifiers/index.ts` - re-exports `countryIdentifiers`
- `tests/country-identifiers.test.ts` - new test file, 27 tests across 8 describe blocks

## Decisions Made
- BR `isComplete` remains strictly length-based; `validate()` is purely additive (matches CONTEXT.md "Claude's Discretion" note to prefer NOT altering the BR completeness gate).
- RUC DV algorithm implemented exactly as specified: weight starts at 2 over the 8 base digits right-to-left, increments per digit, resets to 2 after exceeding 11 — verified against the concrete example (`800177266` → DV 6 correct, `800177261` → DV mismatch, rejected).
- EIN validation kept format-only (9 digits) since there's no public IRS check-digit algorithm, matching CONTEXT.md's explicit note.

## Deviations from Plan

None - plan executed exactly as written. All behavior cases from the plan's `<behavior>` blocks were implemented and asserted in tests; no architectural changes, no missing functionality found, no blocking issues encountered.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `countryIdentifiers.ts` registry is ready for 04-02 (UI wiring: `DocumentIdInput`, `CountrySelect`, signup pages) and 04-03 (review display generalization) to consume via `getIdentifierSpec`/`defaultCountryForLocale`.
- Cross-repo note (deferred, unchanged from CONTEXT.md): backend (`doqyn-auth-service`) validation/acceptance of non-BR documents remains out of scope for this milestone.
- No blockers for 04-02/04-03.

---
*Phase: 04-identificadores-fiscais-por-pais*
*Completed: 2026-07-17*

## Self-Check: PASSED

- FOUND: src/lib/identifiers/countryIdentifiers.ts
- FOUND: tests/country-identifiers.test.ts
- FOUND: commit ce0c7fb
- FOUND: commit 7d9df0e
