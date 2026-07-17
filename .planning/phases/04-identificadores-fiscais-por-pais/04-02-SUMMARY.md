---
phase: 04-identificadores-fiscais-por-pais
plan: 02
subsystem: ui
tags: [i18n, cpf, cnpj, ruc, ssn, ein, ci, react-i18next, review-display, forms]

# Dependency graph
requires:
  - phase: 04-identificadores-fiscais-por-pais (plan 01)
    provides: countryIdentifiers registry (getIdentifierSpec, SUPPORTED_COUNTRIES, countryLabelKey, CountryCode/PersonType types)
provides:
  - DocumentIdInput — country-aware masked input built on useFormattedInput + getIdentifierSpec
  - CountrySelect — controlled country picker over SUPPORTED_COUNTRIES with localized labels
  - Generalized reviewDisplay (formatDocument/formatDocumentForReview) accepting (value, country, personType) with BR-compatible legacy overloads and per-country personal-ID masking
  - identifiers i18n namespace registered for pt-BR/es-PY/en-US
affects: [04-03, signup pages, access-request review, individual/company signup review]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TypeScript function overloads used to add a generic (value, country, personType) API to reviewDisplay while keeping the old BR-only (value, 'CPF'|'CNPJ') signature compiling unchanged for existing callers"
    - "DocumentIdInput mirrors TaxIdInput's useFormattedInput + Input composition, but derives format/placeholder/inputMode/completeness from getIdentifierSpec(country, personType) instead of a hardcoded kind"
    - "Personal-ID review masking (CPF/SSN/CI) implemented as country-specific branches inside formatDocumentForReview; company IDs (CNPJ/EIN/RUC) always rendered in full via spec.format"

key-files:
  created:
    - src/components/ui/DocumentIdInput.tsx
    - src/components/ui/CountrySelect.tsx
    - src/i18n/locales/pt-BR/identifiers.json
    - src/i18n/locales/es-PY/identifiers.json
    - src/i18n/locales/en-US/identifiers.json
    - tests/country-review-display.test.ts
  modified:
    - src/lib/reviewDisplay.ts
    - src/i18n/index.ts

key-decisions:
  - "formatDocument/formatDocumentForReview overload resolution relies on TaxIdKind ('CPF'|'CNPJ') and CountryCode ('BR'|'PY'|'US') being disjoint string-literal unions, so a single resolveCountryPersonType() runtime helper can narrow correctly without a discriminant flag"
  - "PY CI masking duplicates a small thousands-grouping helper locally in reviewDisplay.ts rather than importing/exporting countryIdentifiers.ts's internal formatThousands, since task 1's files_modified scope excluded that registry file"
  - "DocumentIdInput's incomplete-field error message uses t(spec.labelKey) (already namespace-prefixed as 'identifiers:doc.x') combined with t('incomplete', { doc }) from the identifiers namespace"

requirements-completed: [DOC-01, DOC-03, DOC-05]

# Metrics
duration: 18min
completed: 2026-07-17
---

# Phase 4 Plan 2: Country-Aware DocumentIdInput, CountrySelect & Generalized Review Display Summary

**Country-aware `DocumentIdInput`/`CountrySelect` components plus a generalized `reviewDisplay` (BR/PY/US masking via `getIdentifierSpec`) with backward-compatible overloads for existing BR signup/access-request callers, and `identifiers` i18n catalogs for all three locales.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-07-17T22:48:00Z
- **Completed:** 2026-07-17T23:06:00Z
- **Tasks:** 2 completed
- **Files modified:** 8 (6 created, 2 modified)

## Accomplishments
- Generalized `formatDocument`/`formatDocumentForReview` in `src/lib/reviewDisplay.ts` to `(value, country, personType)`, backed by the 04-01 `countryIdentifiers` registry, while adding TypeScript overloads that keep the legacy `(value, 'CPF'|'CNPJ')` BR-only call sites (`individualSignupReview.ts`, `companySignupReview.ts`, `requestAccessReview.ts`) compiling and producing byte-identical output.
- Implemented per-country personal-ID masking in `formatDocumentForReview`: CPF `529.***.***-25`, SSN `***-**-6789`, CI `*.***.567` (reveal last 3 digits with thousands grouping); company IDs (CNPJ/EIN/RUC) always rendered in full via `spec.format`.
- Built `DocumentIdInput` (mask/placeholder/inputMode/completeness driven entirely by `getIdentifierSpec(country, personType)`, mirroring `TaxIdInput`'s structure without modifying that file) and `CountrySelect` (controlled `Select` over `SUPPORTED_COUNTRIES` with localized labels via `countryLabelKey`).
- Added `identifiers.json` catalogs for pt-BR/es-PY/en-US (`country.{BR,PY,US}`, `doc.{cpf,cnpj,ci,ruc,ssn,ein}`, `incomplete`) and registered the `identifiers` namespace in `src/i18n/index.ts` (`resources` + `ns` array), without touching `defaultNS` or other init options.
- Added `tests/country-review-display.test.ts` (12 tests) covering all masking cases, company full-format cases, the legacy overload back-compat path, and empty-value handling.

## Task Commits

Each task was committed atomically:

1. **Task 1: Generalize reviewDisplay to (value, country, personType) with BR back-compat** - `9a9f382` (feat)
2. **Task 2: DocumentIdInput + CountrySelect components + identifiers i18n catalogs** - `7b211dc` (feat)

## Files Created/Modified
- `src/lib/reviewDisplay.ts` - `formatDocument`/`formatDocumentForReview` generalized via overloads to `(value, country, personType)`, with a `resolveCountryPersonType` helper mapping legacy `'CPF'|'CNPJ'` to `('BR', 'individual'|'company')`; per-country masking (CPF/SSN/CI) added, company docs shown in full; `safeDisplayValue`/`formatPhone`/`formatBooleanConsent`/`PASSWORD_REVIEW_LABEL` left byte-identical
- `tests/country-review-display.test.ts` - new test file, 12 tests across 6 describe blocks (masking, company full-format, unmasked format, legacy overload back-compat, empty input)
- `src/components/ui/DocumentIdInput.tsx` - new component: `useFormattedInput` + `getIdentifierSpec(country, personType)` drive format/placeholder/inputMode/completeness; incomplete-field error via `identifiers:incomplete` i18n key
- `src/components/ui/CountrySelect.tsx` - new component: controlled `Select` over `SUPPORTED_COUNTRIES`, labels via `t(countryLabelKey(code))`
- `src/i18n/locales/pt-BR/identifiers.json`, `src/i18n/locales/es-PY/identifiers.json`, `src/i18n/locales/en-US/identifiers.json` - new catalogs, identical key shape, localized country/document names
- `src/i18n/index.ts` - imports the three `identifiers.json` files, registers `identifiers` under each locale in `resources`, adds `'identifiers'` to the `ns` array

## Decisions Made
- Overload dispatch for `formatDocument`/`formatDocumentForReview` relies on `TaxIdKind` and `CountryCode` being disjoint literal string unions — a single runtime helper (`resolveCountryPersonType`) narrows by value equality (`'CPF'`/`'CNPJ'`) without needing an explicit discriminant argument.
- PY CI review masking duplicates a small local `groupThousands`/`maskKeepingLastDigits` helper in `reviewDisplay.ts` instead of exporting `countryIdentifiers.ts`'s internal `formatThousands`, since Task 1's file scope was limited to `reviewDisplay.ts` + its test — kept the registry file untouched as planned.
- `DocumentIdInput`'s validation error reuses `spec.labelKey` (already `identifiers:doc.x`-prefixed by the registry) directly as the i18next key passed into the `incomplete` interpolation, avoiding a second lookup table.

## Deviations from Plan

None - plan executed exactly as written. All `<behavior>` cases in Task 1 were implemented and asserted; Task 2's acceptance criteria (components, catalogs, namespace registration, no new type errors) were all met without needing Rule 1-4 fixes.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `DocumentIdInput`, `CountrySelect`, and the generalized `reviewDisplay` are ready for 04-03 to consume in the individual/company signup pages and access-request flow.
- Existing BR review callers (`individualSignupReview.ts`, `companySignupReview.ts`, `requestAccessReview.ts`) required zero edits and type-check cleanly against the new overloads.
- No blockers for 04-03.

---
*Phase: 04-identificadores-fiscais-por-pais*
*Completed: 2026-07-17*

## Self-Check: PASSED

- FOUND: src/components/ui/DocumentIdInput.tsx
- FOUND: src/components/ui/CountrySelect.tsx
- FOUND: src/lib/reviewDisplay.ts
- FOUND: src/i18n/locales/pt-BR/identifiers.json
- FOUND: src/i18n/locales/es-PY/identifiers.json
- FOUND: src/i18n/locales/en-US/identifiers.json
- FOUND: tests/country-review-display.test.ts
- FOUND: commit 9a9f382
- FOUND: commit 7b211dc
