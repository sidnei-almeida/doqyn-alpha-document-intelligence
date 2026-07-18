---
phase: 05-telefone-por-pais-integracao-no-cadastro
plan: 04
subsystem: ui
tags: [i18n, react-i18next, auth, signup, login]

# Dependency graph
requires:
  - phase: 05-telefone-por-pais-integracao-no-cadastro (plan 02)
    provides: "PhoneInput-wired IndividualSignupPage/CompanySignupPage (country-aware WhatsApp field) as the pages to translate"
provides:
  - "auth i18n namespace (pt-BR/es-PY/en-US) covering login + individual/company signup visible copy"
  - "Login.tsx, IndividualSignupPage.tsx, CompanySignupPage.tsx rendering all primary visible strings via t('auth:...')"
  - "tests/i18n-auth-namespace.test.ts guarding key parity + non-empty values + pt-BR back-compat"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "New namespace catalogs registered following the existing pt-BR/es-PY/en-US + ns-array pattern in src/i18n/index.ts (mirrors the identifiers namespace added in Phase 4)"
    - "Nested JSON catalog keys (login.*, signup.common.*, signup.individual.*, signup.company.*) flattened recursively by the parity test, extending the flat-key i18n-catalogs.test.ts pattern to nested groups"

key-files:
  created:
    - src/i18n/locales/pt-BR/auth.json
    - src/i18n/locales/es-PY/auth.json
    - src/i18n/locales/en-US/auth.json
    - tests/i18n-auth-namespace.test.ts
  modified:
    - src/i18n/index.ts
    - src/pages/Login.tsx
    - src/features/individual-signup/IndividualSignupPage.tsx
    - src/features/company-signup/CompanySignupPage.tsx

key-decisions:
  - "auth.json uses nested groups (login, signup.common, signup.individual, signup.company) rather than a flat key list, so shared field labels (firstName/lastName/email/whatsapp/country/password/confirmPassword/back) are defined once in signup.common and reused by both signup pages"
  - "CompanySignupPage's module-level COMPANY_AUTHORIZATION_TEXT constant was inlined as a t() call inside the component body, since translation hooks are only usable inside component scope"
  - "Toast/fallback strings (success messages, catch-block error fallbacks, terms-required text) were migrated alongside primary labels because they live directly in the three page files (in scope) and were explicitly listed in the plan's interfaces section, even though they are secondary/rare-path copy"

patterns-established:
  - "Nested-JSON i18n catalogs with a recursive flatten-and-compare parity test, for namespaces with more than a flat one-level key structure"

requirements-completed: [TEL-02]

# Metrics
duration: 12min
completed: 2026-07-18
---

# Phase 5 Plan 4: Auth/signup i18n namespace Summary

**New `auth` i18next namespace (pt-BR/es-PY/en-US) with Login, individual-signup, and company-signup pages migrated from hardcoded pt-BR strings to `t('auth:...')` calls, localizing the TEL-02 phone/country fields alongside the rest of the auth surface.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-18T03:31:00Z
- **Completed:** 2026-07-18T03:43:25Z
- **Tasks:** 3 completed
- **Files modified:** 8 (4 created, 4 modified)

## Accomplishments
- New `src/i18n/locales/{pt-BR,es-PY,en-US}/auth.json` catalogs with a `login` group (eyebrow/title/description/footer/hints/OAuth buttons/field labels/checkbox/submit) and a `signup` group (`common` shared field labels + `individual`/`company` screen-specific copy)
- `src/i18n/index.ts` registers `auth` in `resources` for all three locales and adds `'auth'` to the `ns` array; `defaultNS` unchanged
- `Login.tsx` now calls `useTranslation('auth')` and renders every primary visible string (eyebrow, title, description, footer link, OAuth hint/button labels, "ou" divider, field labels/placeholders, remember-me/forgot-password, submit/loading label, generic catch-block error) via `t('login.*')`
- `IndividualSignupPage.tsx` and `CompanySignupPage.tsx` both call `useTranslation('auth')` and render section headers, shared field labels (including the WhatsApp/phone label passed to `PhoneInput` and the País/country label passed to `CountrySelect`), buttons, back link, toast success messages, and error fallbacks via `t('signup.common.*')` / `t('signup.individual.*')` / `t('signup.company.*')`
- `CompanySignupPage.tsx`'s previously module-level `COMPANY_AUTHORIZATION_TEXT` constant is now `t('signup.company.authorizationText')` called inside the component
- New `tests/i18n-auth-namespace.test.ts` (4 assertions): recursive key-flattening parity check across the three locales, non-empty-value check, presence of `login`/`signup` groups, and a pt-BR value lock (`login.title`, `login.submit`, `signup.common.whatsapp`, `signup.individual.submit`) to guard against accidental copy drift
- pt-BR values in `auth.json` are verbatim copies of the strings previously hardcoded in the three pages — no visible change for pt-BR users
- Verified `tests/i18n-catalogs.test.ts` (untouched, still green) and `tests/phone-signup-integration.test.ts` + `tests/country-signup-integration.test.ts` (22 assertions, still green) — the 05-02 PhoneInput/CountrySelect wiring and its E.164/review formatting logic were not touched, only the label strings feeding them

## Task Commits

Each task was committed atomically:

1. **Task 1: Create auth catalogs and register the auth namespace** - `8c6ee15` (feat)
2. **Task 2: Migrate Login and both signup pages to t('auth:...')** - `a11a0d7` (feat)
3. **Task 3: Test auth namespace key parity and non-empty values** - `e7aa5e8` (test)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `src/i18n/locales/pt-BR/auth.json` - pt-BR login + signup copy (verbatim from prior hardcoded strings)
- `src/i18n/locales/es-PY/auth.json` - es-PY (Paraguay Spanish) translations, same key structure
- `src/i18n/locales/en-US/auth.json` - en-US translations, same key structure
- `src/i18n/index.ts` - `auth` namespace added to `resources` (all 3 locales) and `ns` array
- `src/pages/Login.tsx` - all visible copy migrated to `t('auth:login.*')`
- `src/features/individual-signup/IndividualSignupPage.tsx` - visible copy migrated to `t('auth:signup.common.*')` / `t('auth:signup.individual.*')`
- `src/features/company-signup/CompanySignupPage.tsx` - visible copy migrated to `t('auth:signup.common.*')` / `t('auth:signup.company.*')`; `COMPANY_AUTHORIZATION_TEXT` constant removed, inlined as `t()` call
- `tests/i18n-auth-namespace.test.ts` - new parity/non-empty/back-compat test for the auth namespace (new)

## Decisions Made
- Grouped signup field labels under `signup.common` (firstName, lastName, email, whatsapp, country, password, confirmPassword, back) since both signup pages share identical labels for these fields — avoids key duplication across `signup.individual`/`signup.company` while still allowing each page's screen-specific strings (eyebrow, description, section title, submit label, toast/error copy) to live in their own namespace group.
- Moved `COMPANY_AUTHORIZATION_TEXT` from a module-level constant into an inline `t()` call inside `CompanySignupPage`, since `useTranslation` can only be invoked inside a component/hook context.
- Migrated secondary copy (toast success messages, catch-block fallback error strings, terms-required text) in addition to primary labels/buttons/titles, since these live directly inside the three page files already being touched and were explicitly called out in the plan's `<interfaces>` section ("validation/toast strings").
- Left `individualSignupReview.ts`/`companySignupReview.ts` validation error messages untouched — those files are not in this plan's `files_modified` list and their string content is a separate concern from the page-level `t()` migration.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- This was the final plan (05-04) of the i18n/multi-country (BR/PY/US) milestone. Login + both signup surfaces, including the TEL-02 phone/country fields, now render in the active language across pt-BR/es-PY/en-US.
- Deferred per STATE.md (unchanged by this plan): persisting the language preference to the user's profile in `doqyn-auth-service`, and translating the remaining app surfaces beyond shell/nav/auth/library/viewer (v1 scope was intentionally partial).
- No blockers identified. A final holistic milestone check (not a new plan) is recommended next, per the phase's own instructions, but no further plan-scoped work remains in Phase 5.

---
*Phase: 05-telefone-por-pais-integracao-no-cadastro*
*Completed: 2026-07-18*

## Self-Check: PASSED

- FOUND: src/i18n/locales/pt-BR/auth.json
- FOUND: src/i18n/locales/es-PY/auth.json
- FOUND: src/i18n/locales/en-US/auth.json
- FOUND: src/i18n/index.ts
- FOUND: src/pages/Login.tsx
- FOUND: src/features/individual-signup/IndividualSignupPage.tsx
- FOUND: src/features/company-signup/CompanySignupPage.tsx
- FOUND: tests/i18n-auth-namespace.test.ts
- FOUND: commit 8c6ee15 (Task 1)
- FOUND: commit a11a0d7 (Task 2)
- FOUND: commit e7aa5e8 (Task 3)
