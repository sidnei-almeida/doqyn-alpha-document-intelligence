---
phase: 04-identificadores-fiscais-por-pais
plan: 03
subsystem: ui
tags: [signup, country-select, cpf, cnpj, ruc, ssn, ein, ci, review-display, react-query]

# Dependency graph
requires:
  - phase: 04-identificadores-fiscais-por-pais (plan 01)
    provides: countryIdentifiers registry (getIdentifierSpec, defaultCountryForLocale, CountryCode/PersonType)
  - phase: 04-identificadores-fiscais-por-pais (plan 02)
    provides: DocumentIdInput, CountrySelect, generalized reviewDisplay (formatDocumentForReview(value, country, personType))
provides:
  - IndividualSignupPage / CompanySignupPage wired to CountrySelect + DocumentIdInput (personType=individual/company)
  - Country-aware payload normalization (getIdentifierSpec(country, personType).normalize) for both signup flows
  - Country-aware review formatting (masked for individual, full for company) in both review modules
  - tests/country-signup-integration.test.ts covering payload + review formatting for BR/PY/US, both person types
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Signup pages own a `country: CountryCode` piece of state seeded from defaultCountryForLocale(getActiveLocale()); changing country clears the taxId field to avoid a stale mask/value from another country's format persisting"
    - "Review-module document field label uses getIdentifierSpec(country, personType).code (plain acronym string, e.g. 'CPF'/'SSN'/'CI') rather than an i18n-translated label — matches the existing signup pages' convention of hardcoded pt-BR strings (no useTranslation usage anywhere in these two feature modules) and the code value is already identical across all three locale catalogs"

key-files:
  created:
    - tests/country-signup-integration.test.ts
  modified:
    - src/features/individual-signup/IndividualSignupPage.tsx
    - src/features/individual-signup/individualSignupReview.ts
    - src/features/company-signup/CompanySignupPage.tsx
    - src/features/company-signup/companySignupReview.ts
    - tests/individual-signup-review.test.ts
    - tests/company-signup-review.test.ts

key-decisions:
  - "Document field label rendered as getIdentifierSpec(country, personType).code (a plain string) rather than a translated labelKey, since the Input component's `label` prop is typed `string` (not ReactNode) and neither signup page currently uses react-i18next anywhere else — introducing useTranslation just for this one label would be an isolated, inconsistent pattern. The identifiers.json catalogs already contain identical doc-code strings across all three locales, so there is no visible i18n regression."
  - "CountrySelect's own label kept as a hardcoded 'País' string, matching the existing hardcoded-Portuguese convention used by every other field label on both pages (Nome, E-mail, WhatsApp, Senha, etc.)."

requirements-completed: [DOC-04, DOC-05]

# Metrics
duration: 22min
completed: 2026-07-17
---

# Phase 4 Plan 3: Country-Aware Individual & Company Signup Summary

**Individual and company signup now pick a country (defaulting from the active locale), render the correct personal/company document field (CPF/CI/SSN, CNPJ/RUC/EIN) via `DocumentIdInput`, send normalized digits in the payload, and format/mask the review section per country.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-07-17T22:28:00Z
- **Completed:** 2026-07-17T22:50:00Z
- **Tasks:** 2 completed
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments
- `IndividualSignupPage` and `CompanySignupPage` each gained a `country: CountryCode` state (defaulted via `defaultCountryForLocale(getActiveLocale())`), a `CountrySelect`, and a `DocumentIdInput` (personType `individual`/`company` respectively) replacing the hardcoded `TaxIdInput kind="CPF"|"CNPJ"`. Changing country clears the document field so no stale mask/value from a previous country persists.
- `individualSignupReview.ts` / `companySignupReview.ts` both gained a `country: CountryCode` field on their form-values types; payload `taxId` is now `getIdentifierSpec(values.country, personType).normalize(values.taxId)` (normalized digits, same `taxId` payload field name — backend contract unchanged); review sections use `formatDocumentForReview(values.taxId, values.country, personType)` with the label sourced from `getIdentifierSpec(...).code`, replacing the hardcoded `'CPF'`/`'CNPJ'` label+value pair.
- Added `tests/country-signup-integration.test.ts` (12 tests): payload normalization for US/PY on both flows, masked review values for BR/US individual documents, full/unmasked review values for BR/PY/US company documents, and source-level assertions that both pages import `DocumentIdInput`/`CountrySelect`/`defaultCountryForLocale` and no longer reference `TaxIdInput`.
- `access-request` (RequestAccessPage/requestAccessReview) left completely untouched — still uses `TaxIdInput` and the legacy BR-only `reviewDisplay` overloads, confirmed via `grep`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire country selection into Individual signup (personType=individual)** - `572568c` (feat)
2. **Task 2: Wire country selection into Company signup (personType=company)** - `eca1e77` (feat)

## Files Created/Modified
- `src/features/individual-signup/IndividualSignupPage.tsx` - adds `country` state + `CountrySelect` + `DocumentIdInput personType="individual"`, removes `TaxIdInput`
- `src/features/individual-signup/individualSignupReview.ts` - `IndividualSignupFormValues.country`, normalized payload `taxId`, dynamic review label/value
- `src/features/company-signup/CompanySignupPage.tsx` - adds `country` state + `CountrySelect` + `DocumentIdInput personType="company"`, removes `TaxIdInput`
- `src/features/company-signup/companySignupReview.ts` - `CompanySignupFormValues.country`, normalized payload `taxId`, dynamic review label/value (full/unmasked)
- `tests/country-signup-integration.test.ts` - new: 12 tests, payload normalization + review formatting across BR/PY/US for both person types, plus page source-import assertions
- `tests/individual-signup-review.test.ts` / `tests/company-signup-review.test.ts` - Rule 1 fix, see Deviations

## Decisions Made
- Document field label uses `getIdentifierSpec(country, personType).code` (plain string) instead of a translated `labelKey`, since neither signup page uses `react-i18next` today and `Input`'s `label` prop is `string`-typed. All three `identifiers.json` locale catalogs already carry identical doc-code strings, so this introduces no visible localization gap.
- `CountrySelect`'s own label stays a hardcoded `'País'`, consistent with every other hardcoded-Portuguese field label already on both pages.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added `country: 'BR'` to pre-existing signup-review test fixtures**
- **Found during:** Task 1 verification (running the full test suite after adding `country: CountryCode` to `IndividualSignupFormValues`)
- **Issue:** `tests/individual-signup-review.test.ts` and `tests/company-signup-review.test.ts` (pre-existing, out of this plan's `files_modified` list) construct `validForm` object literals typed against `IndividualSignupFormValues`/`CompanySignupFormValues`. Adding the new required `country` field to those types broke these two files at the type level (missing required property) — a direct, in-scope consequence of this task's type change, not a pre-existing/baseline failure.
- **Fix:** Added `country: 'BR' as const` to both `validForm` fixtures, matching the BR-only values (`CPF`/`CNPJ`) those tests already exercise. No assertions changed.
- **Files modified:** `tests/individual-signup-review.test.ts`, `tests/company-signup-review.test.ts`
- **Verification:** Both test files pass (`npx tsx --test tests/individual-signup-review.test.ts tests/company-signup-review.test.ts`); `npx tsc -p tsconfig.app.json --noEmit` shows no errors in either file.
- **Committed in:** `572568c` (individual fixture, part of Task 1 commit), `eca1e77` (company fixture, part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug, type-breakage in pre-existing tests directly caused by this plan's type change)
**Impact on plan:** Necessary to keep the type-check and test suite green after widening `IndividualSignupFormValues`/`CompanySignupFormValues`. No scope creep — only the minimal fixture field was added, no new behavior tested.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Individual and company signup both select a country, render the correct document field/label/mask/validation, send normalized digits, and format/mask the review section per country — the phase's user-visible payoff is complete.
- `access-request` remains on `TaxIdInput` + the legacy BR-only `reviewDisplay` overloads by design (out of scope per plan), confirmed unchanged.
- T-04-05 (backend acceptance of non-BR documents in `doqyn-auth-service`) remains a deferred cross-repo follow-up, not a blocker for this phase.
- No blockers for subsequent phases.

---
*Phase: 04-identificadores-fiscais-por-pais*
*Completed: 2026-07-17*

## Self-Check: PASSED

- FOUND: src/features/individual-signup/IndividualSignupPage.tsx (DocumentIdInput/CountrySelect present, TaxIdInput absent)
- FOUND: src/features/individual-signup/individualSignupReview.ts (country field, normalize, formatDocumentForReview)
- FOUND: src/features/company-signup/CompanySignupPage.tsx (DocumentIdInput/CountrySelect present, TaxIdInput absent)
- FOUND: src/features/company-signup/companySignupReview.ts (country field, normalize, formatDocumentForReview)
- FOUND: tests/country-signup-integration.test.ts (12/12 passing)
- FOUND: commit 572568c
- FOUND: commit eca1e77
- VERIFIED: `npx tsx --test tests/country-signup-integration.test.ts` - 12 pass, 0 fail
- VERIFIED: `npx tsc -p tsconfig.app.json --noEmit` - no new errors in the four modified signup files (only pre-existing baseline TS6133 in unrelated `document-update-version` file)
- VERIFIED: `grep -l TaxIdInput src/features/access-request/RequestAccessPage.tsx` - access-request unchanged, still uses TaxIdInput
