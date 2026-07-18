---
phase: 02-seletor-de-idioma-persistencia
plan: 02
subsystem: ui
tags: [react-i18next, react, ui, settings, header]

# Dependency graph
requires:
  - phase: 02-seletor-de-idioma-persistencia (plan 01)
    provides: useLocale() hook, language.* catalog keys in all three common.json namespaces, locale persistence + precedence
provides:
  - Reusable LanguageSelect component (src/components/ui/LanguageSelect.tsx) driven by useLocale + language.* keys
  - Language control mounted in HeaderUserMenu account popover (near ThemeToggle)
  - Language control mounted in Settings > Preferences (SettingsRow, near the Tema row)
  - Source-assertion regression test locking in both placements + hook/catalog wiring
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Segmented-control radiogroup pattern (settings-segmented-control / __item--active classes) reused for a third control (Tema, Visualização, now Idioma)"

key-files:
  created:
    - src/components/ui/LanguageSelect.tsx
    - tests/i18n-language-selector.test.ts
  modified:
    - src/components/layout/HeaderUserMenu.tsx
    - src/features/settings/components/sections/PreferencesSettingsSection.tsx

key-decisions:
  - "LanguageSelect is presentation-only: all locale state and side effects (changeLanguage, persistence) flow through useLocale(); the component never touches localStorage or i18n directly"
  - "In the narrow (w-56) header popover, the language row uses a stacked label-above-control layout (flex-col) rather than the inline label-beside-control layout used for Tema, so all three native names stay legible"

patterns-established: []

requirements-completed: [SEL-01, SEL-03]

# Metrics
duration: 3min
completed: 2026-07-17
---

# Phase 02 Plan 02: Language Selector UI Summary

**Reusable segmented-control LanguageSelect component mounted in both the header account popover and Settings > Preferences, switching the UI language live via useLocale with no page reload.**

## Performance

- **Duration:** ~3 min
- **Completed:** 2026-07-17T18:15:05Z
- **Tasks:** 3 completed
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `src/components/ui/LanguageSelect.tsx` renders a `role="radiogroup"` of `role="radio"` buttons — one per `useLocale().supportedLocales` entry — with `aria-checked` bound to the active locale, calling `setLocale(loc)` on click; all visible labels come from `language.*` catalog keys via `useTranslation('common')`, no hardcoded native names
- `HeaderUserMenu.tsx` now shows a language row (label + `LanguageSelect`) directly below the existing Tema/`ThemeToggle` row inside the account popover, stacked (label above control) to keep all three native names legible in the narrow `w-56` popover
- `PreferencesSettingsSection.tsx` now has a language `SettingsRow` (using the new `t('language.label')`) positioned right after the Tema row, reusing the existing `SettingsRow`/`SettingsRowList` composition unchanged
- `tests/i18n-language-selector.test.ts` (source-assertion style, mirroring `tests/i18n-shell-nav.test.ts`) asserts the component wires `useLocale` + `language.*` keys with no hardcoded native names, that both `HeaderUserMenu.tsx` and `PreferencesSettingsSection.tsx` reference `LanguageSelect`, and that all three `common.json` catalogs define the `language` object with the expected native names

## Task Commits

Each task was committed atomically:

1. **Task 1: Reusable LanguageSelect component** - `d2051cb` (feat)
2. **Task 2: Mount LanguageSelect in header popover and Settings preferences** - `261278d` (feat)
3. **Task 3: Source-assertion test for selector wiring in both surfaces** - `d22e389` (test)

**Plan metadata:** (this commit, see below)

## Files Created/Modified
- `src/components/ui/LanguageSelect.tsx` - reusable, catalog-driven language selector (segmented-control radiogroup) consuming `useLocale`
- `src/components/layout/HeaderUserMenu.tsx` - added `useTranslation('common')` + a language row (label + `LanguageSelect`) in the account popover, next to the Tema row; existing Settings link, Tema/`ThemeToggle` row, and Sair button untouched
- `src/features/settings/components/sections/PreferencesSettingsSection.tsx` - added `useTranslation('common')` + a new `SettingsRow` for language (label from `language.label`, `LanguageSelect` as control), positioned after the Tema row; existing theme/default-view logic untouched
- `tests/i18n-language-selector.test.ts` - source-assertion regression coverage for both placements + hook/catalog wiring

## Decisions Made
- Kept `LanguageSelect` fully presentation-only — no direct `localStorage`/`i18n.changeLanguage` calls — so all live-switch + persistence behavior stays centralized in `useLocale` (plan 01).
- Used a stacked (label-above-control) layout for the header popover's language row instead of the inline label-beside-control layout used for Tema, since the popover's `w-56` width isn't wide enough to keep three native-language labels legible inline.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Note: `npm test -- tests/i18n-language-selector.test.ts` runs the *entire* suite (the `test` script hardcodes `tests/**/*.test.ts` as its glob, so the extra CLI arg is appended rather than substituted) and surfaces pre-existing baseline failures from the `feat/document-chat` branch in unrelated files (documented in the task prompt as out-of-scope). Ran `npx tsx --test tests/i18n-language-selector.test.ts` directly instead to confirm the new test file's 5 assertions all pass in isolation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SEL-01 and SEL-03 are now fully closed: users can change language from both required surfaces (header + Settings), the switch is immediate (no reload), and the choice persists across sessions (via plan 01's `useLocale`/`localePreference` layer).
- Phase 02 (seletor-de-idioma-persistencia) is complete with both plans (01: persistence layer, 02: selector UI) delivered.
- No blockers identified.

---
*Phase: 02-seletor-de-idioma-persistencia*
*Completed: 2026-07-17*

## Self-Check: PASSED

All created/modified files verified present on disk; all 3 task commit hashes (d2051cb, 261278d, d22e389) verified present in git log.
