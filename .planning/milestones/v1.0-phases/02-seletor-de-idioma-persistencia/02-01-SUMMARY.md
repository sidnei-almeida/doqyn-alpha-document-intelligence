---
phase: 02-seletor-de-idioma-persistencia
plan: 01
subsystem: i18n
tags: [react-i18next, localStorage, locale-persistence, typescript]

# Dependency graph
requires:
  - phase: 01-fundacao-i18n
    provides: react-i18next singleton (src/i18n/index.ts), SUPPORTED_LOCALES/resolveSupportedLocale (src/i18n/config.ts), useDocumentLang (<html lang> sync)
provides:
  - Locale persistence utility (getStoredLocale/setStoredLocale) under key `doqyn.locale`
  - Pure resolveInitialLocale precedence helper (stored preference wins over browser detection)
  - useLocale() hook exposing { locale, setLocale, supportedLocales } for live language switching
  - language.* catalog keys (label + native names) in all three common.json namespaces
affects: [02-seletor-de-idioma-persistencia plan 02 (selector UI)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "localStorage try/catch wrapper mirroring src/features/library/utils/libraryDefaultView.ts"
    - "Pure precedence resolver (resolveInitialLocale) kept DOM-free/testable, separate from the localStorage/navigator IO wrappers"

key-files:
  created:
    - src/i18n/localePreference.ts
    - src/i18n/useLocale.ts
    - tests/i18n-locale-preference.test.ts
  modified:
    - src/i18n/index.ts
    - src/i18n/locales/pt-BR/common.json
    - src/i18n/locales/es-PY/common.json
    - src/i18n/locales/en-US/common.json

key-decisions:
  - "Stored locale preference (doqyn.locale) takes precedence over browser auto-detection at i18next init, per SEL-02"
  - "useLocale decouples from the i18next singleton import, obtaining the instance via useTranslation() to match useDocumentLang's pattern"
  - "language.* native-name values (Português/Español/English) are identical across all three catalogs; only language.label is localized per language"

patterns-established:
  - "Locale persistence lives in a dedicated module (localePreference.ts) separate from the i18next init file, keeping the precedence rule pure and unit-testable without DOM stubs"

requirements-completed: [SEL-02, SEL-03]

# Metrics
duration: 20min
completed: 2026-07-17
---

# Phase 02 Plan 01: i18n Persistence Layer Summary

**Locale persistence via localStorage (`doqyn.locale`) with stored-preference-first precedence over browser detection, plus a `useLocale` hook for live language switching and `language.*` catalog keys for the selector UI.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-17T18:10:08Z
- **Tasks:** 3 completed
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments
- `src/i18n/localePreference.ts` exports `getStoredLocale`/`setStoredLocale` (try/catch localStorage wrapper mirroring `libraryDefaultView.ts`) and a pure `resolveInitialLocale` that enforces stored-over-detected precedence
- `src/i18n/index.ts` now resolves its initial `lng` via `resolveInitialLocale(getStoredLocale(), detectedLanguages)` instead of browser detection alone
- New `useLocale()` hook (`src/i18n/useLocale.ts`) returns `{ locale, setLocale, supportedLocales }`; `setLocale` calls `i18n.changeLanguage` + `setStoredLocale` for immediate switch + persistence, with `<html lang>` sync handled automatically by the existing `useDocumentLang`
- `language.*` keys (label + native pt-BR/es-PY/en-US names) added to all three `common.json` catalogs for the plan-02 selector UI

## Task Commits

Each task was committed atomically:

1. **Task 1: Locale persistence util + pure initial-locale resolver** - `9b908da` (feat)
2. **Task 2: Wire stored-preference precedence into i18next init + useLocale hook** - `28193ec` (feat)
3. **Task 3: Author language.* catalog keys in all three common namespaces** - `10c3594` (feat)

**Plan metadata:** (this commit, see below)

## Files Created/Modified
- `src/i18n/localePreference.ts` - `LOCALE_STORAGE_KEY`, `getStoredLocale`, `setStoredLocale`, `resolveInitialLocale` (pure precedence rule)
- `tests/i18n-locale-preference.test.ts` - unit coverage: validation, precedence, localStorage-throw fallback
- `src/i18n/index.ts` - initial `lng` now sourced from `resolveInitialLocale(getStoredLocale(), detectedLanguages)`
- `src/i18n/useLocale.ts` - `useLocale()` hook: `{ locale, setLocale, supportedLocales }`
- `src/i18n/locales/pt-BR/common.json` - added `language.label` ("Idioma") + native names
- `src/i18n/locales/es-PY/common.json` - added `language.label` ("Idioma") + native names
- `src/i18n/locales/en-US/common.json` - added `language.label` ("Language") + native names

## Decisions Made
- Kept `resolveInitialLocale` DOM-free/pure (no `localStorage`/`navigator` references) so precedence logic is unit-testable without DOM stubs; the IO wrappers (`getStoredLocale`/`setStoredLocale`) own all localStorage access and error handling.
- `useLocale` obtains the i18next instance via `useTranslation()` rather than importing the singleton directly, matching the existing `useDocumentLang` convention and keeping the hook decoupled from the module singleton.
- Native locale names (`Português`, `Español`, `English`) are non-translated and identical across all three catalogs; only the `label` field differs per language.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `useLocale()` and the `language.*` catalog keys are ready for plan 02's selector UI to consume directly.
- Persistence + precedence loop is complete: a saved preference now survives across sessions and wins over auto-detection, with live switching (no reload) via `useLocale().setLocale`.
- No blockers identified.

---
*Phase: 02-seletor-de-idioma-persistencia*
*Completed: 2026-07-17*

## Self-Check: PASSED

All created/modified files verified present on disk; all 3 task commit hashes (9b908da, 28193ec, 10c3594) verified present in git log.
