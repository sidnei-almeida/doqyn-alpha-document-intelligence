---
phase: 05-telefone-por-pais-integracao-no-cadastro
plan: 02
subsystem: ui
tags: [phone, e164, i18n, signup, react, br, py, us]

# Dependency graph
requires:
  - phase: 05-telefone-por-pais-integracao-no-cadastro (plan 01)
    provides: "phone.ts registry (formatPhone/toE164/isCompletePhone/defaultPhoneCountry/PHONE_COUNTRIES) for BR/PY/US"
provides:
  - "PhoneInput component: DDI/country selector + formatted phone input, reusable wherever country-aware phone entry is needed"
  - "Country-aware reviewDisplay.formatPhone(value, country?) with legacy single-arg behavior preserved for access-request/invite"
  - "Individual + company signup forms send E.164 whatsapp with dial code, country-selectable, defaulting to locale"
affects: [05-03 (server contactNormalize generalization), future phone-country consumers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Composite field pattern: PhoneInput = CountrySelect (DDI) + Input, mirroring WhatsappInput's useFormattedInput wiring but parameterized by country"
    - "Optional trailing parameter for back-compat overload (reviewDisplay.formatPhone(value, country?)) instead of a new function name, preserving all 2 existing single-arg call sites untouched"

key-files:
  created:
    - src/components/ui/PhoneInput.tsx
    - tests/phone-signup-integration.test.ts
  modified:
    - src/lib/reviewDisplay.ts
    - src/features/individual-signup/individualSignupReview.ts
    - src/features/company-signup/companySignupReview.ts
    - src/features/individual-signup/IndividualSignupPage.tsx
    - src/features/company-signup/CompanySignupPage.tsx

key-decisions:
  - "PhoneInput composes CountrySelect (localized country names) as the DDI selector instead of a bespoke dial-code dropdown, reusing existing i18n plumbing"
  - "whatsappCountry added as an optional form field (defaulting to 'BR' at the payload/review call sites) rather than required, so existing fixtures/tests that omit it keep building valid BR payloads"
  - "reviewDisplay.formatPhone kept as a single overloaded function (optional 2nd param) rather than a new export, since access-request and invite review builders call the 1-arg form and must not need any changes"

patterns-established:
  - "Country-parameterized formatting functions expose an optional trailing CountryCode param for back-compat instead of introducing parallel v2 functions"

requirements-completed: [TEL-01, TEL-02]

# Metrics
duration: 9min
completed: 2026-07-17
---

# Phase 5 Plan 2: PhoneInput + country-aware signup phone Summary

**PhoneInput (DDI selector + formatted input) wired into both signup flows, payloads now send E.164 with the selected country's dial code (BR byte-identical), and review shows the phone formatted per country.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-17T20:16:43-03:00
- **Completed:** 2026-07-17T20:21:15-03:00
- **Tasks:** 3 completed
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments
- New `src/components/ui/PhoneInput.tsx`: composes `CountrySelect` (DDI) + `Input`, formats via `phone.ts`'s `formatPhone`/`isCompletePhone`, and reformats the current value when the country changes
- `reviewDisplay.formatPhone` gained an optional `country?: CountryCode` param; the legacy single-arg BR/international behavior is unchanged for `access-request` and `invite` review builders
- Both `IndividualSignupFormValues` and `CompanySignupFormValues` gained an optional `whatsappCountry?: CountryCode`; payload builders now send `toE164(whatsapp, whatsappCountry ?? 'BR')` instead of `toWhatsappApiValue(whatsapp)`
- Both signup pages track a `phoneCountry` state (default `defaultPhoneCountry(getActiveLocale())`) and render `<PhoneInput>` instead of `<WhatsappInput>`; `WhatsappInput.tsx` itself is untouched and still used by its other 4 callers
- New `tests/phone-signup-integration.test.ts` (10 assertions): BR regression (`'5554999999999'`), PY (`'595981234567'` / `'+595 981 234 567'`), US (`'12025550123'` / `'+1 (202) 555-0123'`) across both individual and company builders, plus a default-to-BR-when-omitted case for each
- `tests/country-signup-integration.test.ts` (Phase 4, 12 assertions) verified still green — its fixtures omit `whatsappCountry`, exercising the `?? 'BR'` default path

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PhoneInput component (DDI selector + formatted input)** - `c3d1a3f` (feat)
2. **Task 2: Country-aware review formatPhone + wire PhoneInput into both signup flows** - `d40589a` (feat)
3. **Task 3: Integration tests for BR/PY/US signup phone payload and review** - `a8563aa` (test)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `src/components/ui/PhoneInput.tsx` - country-aware phone input (DDI selector + formatted input via `useFormattedInput`)
- `src/lib/reviewDisplay.ts` - `formatPhone(value, country?)` overload; legacy 1-arg path (`formatWhatsapp`) unchanged
- `src/features/individual-signup/individualSignupReview.ts` - `whatsappCountry?` field, `toE164` payload, country-aware review value
- `src/features/company-signup/companySignupReview.ts` - identical changes for the company flow
- `src/features/individual-signup/IndividualSignupPage.tsx` - `phoneCountry` state + `<PhoneInput>` wiring
- `src/features/company-signup/CompanySignupPage.tsx` - identical wiring for the company flow
- `tests/phone-signup-integration.test.ts` - BR/PY/US payload + review coverage for both signup flows (new)

## Decisions Made
- Reused `CountrySelect` (already localized via `identifiers` i18n namespace) as the DDI selector inside `PhoneInput` rather than building a separate dial-code-only dropdown — per plan's "Claude's Discretion" note, this gives localized country names for free and keeps a single source of truth for supported countries.
- Kept `toWhatsappApiValue` exported/unchanged in `whatsapp.ts` since `access-request` and `invite` review builders still depend on it; only the signup builders switched to `toE164`.
- `whatsappCountry` defaults to `'BR'` at the two call sites (payload + review), not via a required field with a default value in the type, so any fixture/tests constructing form values without it keep working (validated by the Phase 4 `country-signup-integration.test.ts` suite passing unmodified).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Client-side phone entry and payload/review formatting is fully country-aware (TEL-01, TEL-02 delivered for the UI layer).
- Server-side `contactNormalize` generalization (05-03, already completed per git log) can now assume the client sends E.164-with-dial-code for BR/PY/US.
- No blockers identified.

---
*Phase: 05-telefone-por-pais-integracao-no-cadastro*
*Completed: 2026-07-17*

## Self-Check: PASSED

- FOUND: src/components/ui/PhoneInput.tsx
- FOUND: tests/phone-signup-integration.test.ts
- FOUND: src/lib/reviewDisplay.ts
- FOUND: src/features/individual-signup/individualSignupReview.ts
- FOUND: src/features/company-signup/companySignupReview.ts
- FOUND: src/features/individual-signup/IndividualSignupPage.tsx
- FOUND: src/features/company-signup/CompanySignupPage.tsx
- FOUND: commit c3d1a3f (Task 1)
- FOUND: commit d40589a (Task 2)
- FOUND: commit a8563aa (Task 3)
