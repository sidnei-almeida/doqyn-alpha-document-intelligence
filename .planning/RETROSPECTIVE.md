# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Internacionalização e multi-país (BR/PY/US)

**Shipped:** 2026-07-18
**Phases:** 5 | **Plans:** 15 | **Sessions:** 2 (interrupted twice by session usage limits, resumed cleanly both times)

### What Was Built
- i18n runtime (react-i18next) with pt-BR/es-PY/en-US catalogs, browser-language auto-detection with pt-BR fallback, dynamic `<html lang>`
- Language selector (header + Settings) with localStorage persistence overriding auto-detection, live switching with no reload
- Central `formatLocale.ts` + `useLocaleFormatters` hook; migrated ~20 hardcoded `'pt-BR'` date/number/sort call sites, byte-identical pt-BR output preserved
- Country-aware fiscal identifier registry (BR CPF/CNPJ, PY CI/RUC with mod-11 check digit, US SSN/EIN) wired into individual + company signup and review, with BR back-compat overloads
- Country-aware phone entry (BR +55, PY +595, US +1) in E.164, DDI selector in signup, server-side `contactNormalize.ts` generalized without breaking BR
- Full translation of the auth surface (Login, both signup forms including review dialogs and validation errors) in all 3 locales

### What Worked
- **Country/CountryCode as a shared type across phases** — Phase 4's `countryIdentifiers.ts` registry (`CountryCode`, `defaultCountryForLocale`, `SUPPORTED_COUNTRIES`) was reused directly by Phase 5's phone registry and `PhoneInput`/`CountrySelect` with zero duplication, confirmed by the integration audit.
- **BR regression guards at every layer** — every phase that touched BR-specific formatting/identifiers/phone logic included an explicit "byte-identical to today" test. This caught nothing broken in the end, but made it safe to move fast.
- **Additive-only changes to existing BR modules** (`taxId.ts`, `whatsapp.ts`) rather than rewriting them — new country logic lived in new files (`countryIdentifiers.ts`, `phone.ts`) that delegate to the old ones for BR. Zero risk to the 14+ existing callers of `WhatsappInput`/`TaxIdInput`.
- **Running the milestone integration audit before completion, not skipping it** — this is the single most valuable step in the whole run. It caught 2 genuine test regressions and 1 latent Node.js compatibility bug that 5 individual phase verifications, each internally consistent, all missed.

### What Was Inefficient
- **Phase-level "no regressions" claims were asserted without diffing the full failing-test list against a captured baseline.** Two phases (03, 05) each introduced one genuine regression while their own VERIFICATION.md claimed zero new failures — both were spot-checks against an approximate count ("~22"), not a diffed set. This should have been three named test files checked, not a number compared.
- **Session usage limits interrupted execution mid-plan twice** (05-02 and mid-05-02's continuation). Both times the underlying git commits had already landed cleanly before the cutoff — only the SUMMARY.md/tracking-close step was lost. Recovery was straightforward (verify commits, re-run tests independently, finish the tracking commit) but cost a full turn each time.
- **A one-liner extraction bug** produced a stray "Note:" bullet in the auto-generated MILESTONES.md entry (from a SUMMARY.md whose one-liner field was empty/malformed) — caught and fixed manually before commit, but worth having `summary-extract` warn on empty one-liners rather than silently emitting `null`.

### Patterns Established
- **Country-parameterized functions take an optional trailing `country`/`locale` parameter defaulting to the active one**, rather than introducing parallel `v2` function names — established in `formatLocale.ts` (Phase 3) and reused by `reviewDisplay.formatPhone`/`formatDocumentForReview` (Phase 4/5). Keeps existing BR-only callers compiling unchanged while giving new callers full control.
- **Pure review/validation builder functions receive `t: TFunction<'namespace'>` as an explicit parameter** rather than importing the i18n singleton directly — established when closing the milestone audit's translation gap in `individualSignupReview.ts`/`companySignupReview.ts`. Keeps these functions framework-agnostic and testable with `i18n.getFixedT(locale, ns)` in Node tests, while staying reactive when called from a component's render with the live `useTranslation()` `t`.
- **`typeof window !== 'undefined'` is the correct DOM-context guard for browser-only APIs, not `typeof navigator !== 'undefined'`** — Node.js 21+ ships a built-in `navigator` global that is not real user data. Any future browser-language/geolocation/etc. detection code in this codebase should gate on `window`, not `navigator` alone.

### Key Lessons
1. Run the milestone-level integration audit before declaring completion, even (especially) when every individual phase reports "passed" — cross-phase regressions and translation-completeness gaps are invisible from inside a single phase's test suite.
2. When migrating hardcoded strings to `t()`, grep the *entire* feature surface for hardcoded literals before calling a page "translated" — this milestone's Phase 5 summary claimed "Login + both signup pages translated" while the review-dialog and validation-error code paths (reached at the exact moment before submission) were still hardcoded pt-BR.
3. `typeof navigator !== 'undefined'` is not a reliable "am I in a browser" check on modern Node.js — always pair it with `typeof window !== 'undefined'` when the code might also execute in a test runner or other non-browser Node context.
4. Byte-identity regression tests for existing-country behavior (BR, in this case) pay for themselves — every phase that touched shared formatting/identifier/phone code had one, and none of the flagged issues were BR regressions; all were newly-added translation/detection code that lacked its own audit-level scrutiny.

### Cost Observations
- Model mix: Opus 4.8 for planning, discuss-equivalent context-writing, and orchestration; Sonnet 5 for all plan execution (gsd-executor) and the integration/audit checks. Roughly even split by wall-clock time.
- Sessions: 2 (autonomous run interrupted twice by usage limits, both times mid-plan-close with git commits already safely landed).
- Notable: the two session interruptions cost re-verification time but zero rework — because every executor commits atomically per task and writes SUMMARY.md as its last step, "resume" was always "verify what already landed, finish the one incomplete step."

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | 2 | 5 | First milestone for this project cycle — established the additive-country-registry pattern and confirmed the value of a pre-completion integration audit. |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 1449 total (1428 pass, 21 pre-existing-baseline fail) | Not tracked as a percentage in this repo | react-i18next, i18next, i18next-browser-languagedetector |

### Top Lessons (Verified Across Milestones)

1. Run the milestone integration audit before completion — it catches cross-phase gaps that per-phase verification structurally cannot see (v1.0).
2. `typeof window !== 'undefined'` over `typeof navigator !== 'undefined'` for browser-context detection on modern Node.js (v1.0).
