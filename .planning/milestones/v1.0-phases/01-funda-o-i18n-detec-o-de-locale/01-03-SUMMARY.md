---
phase: 01-funda-o-i18n-detec-o-de-locale
plan: 03
subsystem: i18n
tags: [react-i18next, i18next, react, provider-wiring, sidebar, topbar]

# Dependency graph
requires:
  - phase: 01-funda-o-i18n-detec-o-de-locale (plan 02)
    provides: "src/i18n/index.ts (configured i18next singleton), common/nav JSON catalogs for pt-BR/es-PY/en-US"
provides:
  - "I18nextProvider wired as the outermost provider in src/app/providers.tsx"
  - "src/i18n/useDocumentLang.ts — hook syncing document.documentElement.lang with the active i18next language (I18N-04)"
  - "Sidebar/SidebarNavItem/WorkspaceTopBar/SidebarStoragePanel migrated to t() against the nav/common namespaces"
  - "NAV_ITEMS_PRIMARY/LIBRARY_VIEWS/ADMIN in src/lib/constants.ts now carry labelKey instead of hardcoded label strings"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "labelKey field on nav item configs resolved via useTranslation('nav') at render time, instead of storing display strings in constants"
    - "Inner no-render component (LangSync) used to invoke a hook that must run inside a provider subtree that itself wraps the component tree"

key-files:
  created:
    - src/i18n/useDocumentLang.ts
    - tests/i18n-shell-nav.test.ts
  modified:
    - src/app/providers.tsx
    - src/lib/constants.ts
    - src/components/layout/Sidebar.tsx
    - src/components/layout/SidebarNavItem.tsx
    - src/components/layout/WorkspaceTopBar.tsx
    - src/components/layout/SidebarStoragePanel.tsx
    - tests/workspace-layout.test.ts
    - tests/sidebar.test.ts
    - tests/document-trash.test.ts
    - tests/library-navigation.test.ts

key-decisions:
  - "useDocumentLang reads i18n from react-i18next's useTranslation() rather than importing the @/i18n singleton directly, keeping it decoupled from a specific instance and testable via the same hook contract every component uses."
  - "I18nextProvider wraps the entire Providers tree (outermost), ahead of QueryClientProvider/ThemeProvider/AuthProvider, so any provider or child component can call t() without ordering constraints."
  - "The lang-sync hook is invoked from a small internal LangSync component (returns null) rendered just inside AuthProvider, since hooks cannot run in the Providers function body before I18nextProvider mounts its context."
  - "Migration approach for nav items: replaced label with labelKey (references the nav namespace) rather than keeping label and mapping separately; SidebarNavItemConfig field renamed accordingly and resolved via t(item.labelKey) inside SidebarNavItem."
  - "No new catalog keys were required — all needed nav/common keys already existed in the 01-02 catalogs (library, sharedWithMe, toSign, recent, favorites, trash, overview, rules, users, audit, tracking, deactivated, settings, administration, help, storage, manage, expandSidebar, collapseSidebar)."

patterns-established:
  - "Provider composition: i18n provider must be outermost so downstream providers/components can translate without a nested-provider re-render dependency."
  - "Source-assertion tests that check for literal hardcoded strings must be updated (not deleted) when those strings become i18n keys, to keep enforcing the underlying behavior with the new representation."

requirements-completed: [I18N-01, I18N-04]

# Metrics
duration: 9min
completed: 2026-07-17
---

# Phase 01 Plan 03: Wiring do provedor i18n e migração do shell/nav Summary

**App wrapped in I18nextProvider with a `<html lang>` sync hook, and Sidebar/TopBar/SidebarStoragePanel migrated off hardcoded Portuguese strings onto `t()` calls against the `nav`/`common` namespaces (all keys already authored in plan 01-02).**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-07-17T17:46:29Z
- **Completed:** 2026-07-17T17:55:24Z
- **Tasks:** 3
- **Files modified:** 12 (2 created, 10 modified)

## Accomplishments
- `src/app/providers.tsx` now imports the configured `@/i18n` singleton and wraps the whole provider tree in `I18nextProvider` (outermost), with a `LangSync` inner component invoking the new `useDocumentLang()` hook
- `src/i18n/useDocumentLang.ts` sets `document.documentElement.lang` on mount and on every `languageChanged` event, unsubscribing on cleanup — delivers I18N-04
- `NAV_ITEMS_PRIMARY`/`NAV_ITEMS_LIBRARY_VIEWS`/`NAV_ITEMS_ADMIN` in `src/lib/constants.ts` migrated from hardcoded `label` strings to `labelKey` references into the `nav` namespace; `SidebarNavItemConfig` renamed accordingly
- `Sidebar.tsx`, `SidebarNavItem.tsx`, `WorkspaceTopBar.tsx`, `SidebarStoragePanel.tsx` all resolve their visible text and aria-labels via `useTranslation`/`t()` — no hardcoded Portuguese remains in the migrated elements
- New source-assertion test `tests/i18n-shell-nav.test.ts` guards the provider wiring, the `useDocumentLang` hook shape, and the shell migration
- Four pre-existing source-assertion tests that literally asserted hardcoded Portuguese nav labels were updated to assert the new `labelKey`/`t()`-based representation, so they keep enforcing the same underlying behavior (no regression coverage lost)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire I18nextProvider and dynamic `<html lang>` sync** - `428a77d` (feat)
2. **Task 2: Migrate sidebar + topbar shell strings to t()** - `ffbdf95` (feat)
3. **Task 3: Source-assert shell migration + provider wiring** - `6240508` (test)

**Plan metadata:** (this commit, docs)

## Files Created/Modified
- `src/i18n/useDocumentLang.ts` - Hook syncing `document.documentElement.lang` with the active i18next language via `languageChanged`
- `src/app/providers.tsx` - Wraps the app in `I18nextProvider`; adds inner `LangSync` component invoking the sync hook
- `src/lib/constants.ts` - `NAV_ITEMS_PRIMARY`/`LIBRARY_VIEWS`/`ADMIN` use `labelKey` instead of hardcoded Portuguese `label`
- `src/components/layout/SidebarNavItem.tsx` - `SidebarNavItemConfig.labelKey`; resolves display/tooltip text via `useTranslation('nav')`
- `src/components/layout/Sidebar.tsx` - Resolves inline Biblioteca item, Administração section label, and collapse/expand aria-labels via `t()`
- `src/components/layout/WorkspaceTopBar.tsx` - Translates Ajuda/Configurações aria-labels via `useTranslation('common')`
- `src/components/layout/SidebarStoragePanel.tsx` - Translates Armazenamento/Gerenciar via `useTranslation('common')` (pluralized document count/percentage copy intentionally left as-is — no matching keys authored in 01-02, per plan instruction not to invent partial coverage)
- `tests/i18n-shell-nav.test.ts` - New source-assertion coverage for provider wiring, `useDocumentLang`, and shell migration
- `tests/workspace-layout.test.ts`, `tests/sidebar.test.ts`, `tests/document-trash.test.ts`, `tests/library-navigation.test.ts` - Updated literal-string assertions to the new labelKey-based representation

## Decisions Made
- Kept `SidebarSection.tsx` string-based (`label` prop unchanged) since the plan calls for translating at the call site (`Sidebar.tsx` passes `t('administration')`), not inside the presentational component.
- Left `SidebarStoragePanel`'s pluralized document-count string and processed-percentage caption untranslated, since plan 01-02 did not author matching keys for these and the plan explicitly forbade inventing partial coverage; documented for future consideration if full storage-panel translation is prioritized later.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed unterminated JSDoc comments caused by `*/` inside file-path globs**
- **Found during:** Task 2 (build verification)
- **Issue:** Added JSDoc comments referencing `src/i18n/locales/*/nav.json` — the `*/` inside the glob pattern closed the block comment early, producing a cascade of TS1131/TS1005/TS1109/TS1161 parse errors in `src/lib/constants.ts` and `src/components/layout/SidebarNavItem.tsx`.
- **Fix:** Reworded the comments to use `<locale>` instead of `*` in the path (`src/i18n/locales/<locale>/nav.json`), avoiding the `*/` sequence.
- **Files modified:** `src/lib/constants.ts`, `src/components/layout/SidebarNavItem.tsx`
- **Verification:** `npm run build` returns to only the 3 pre-existing baseline TS6133 errors (unrelated files).
- **Committed in:** `ffbdf95` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed 4 pre-existing tests broken by the intentional label→labelKey migration**
- **Found during:** Task 3 (`npm test` verification)
- **Issue:** `tests/workspace-layout.test.ts`, `tests/sidebar.test.ts`, `tests/document-trash.test.ts`, and `tests/library-navigation.test.ts` contained source-assertion checks for literal hardcoded Portuguese nav labels (`'Compartilhados comigo'`, `'Administração'`, `'Desativados'`, `'Visão Geral'`) in `src/lib/constants.ts`/`Sidebar.tsx`. These strings were intentionally removed by this plan's Task 2 migration, so the tests started failing — a direct, in-scope consequence of the planned change to files these tests assert on.
- **Fix:** Updated each assertion to check for the corresponding `labelKey` (`sharedWithMe`, `deactivated`, `overview`) or the `t('administration')` call, preserving the original test's intent (verifying the nav item/section exists and is wired correctly) against the new i18n-key-based representation.
- **Files modified:** `tests/workspace-layout.test.ts`, `tests/sidebar.test.ts`, `tests/document-trash.test.ts`, `tests/library-navigation.test.ts`
- **Verification:** `npm test` returns to the same 22 pre-existing baseline failures (unrelated to i18n/sidebar/nav), no new failures.
- **Committed in:** `6240508` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 bug in newly-added comments, 1 bug in pre-existing tests directly conflicting with planned migration)
**Impact on plan:** Both fixes were necessary to complete the plan's stated migration cleanly; no scope creep — only files this plan already touches (or tests asserting on them) were changed.

## Issues Encountered

`npm run build` (`tsc -b`) still fails with exit code 2 due to the same 3 pre-existing TypeScript errors documented in 01-01/01-02 summaries (`src/features/document-update-version/utils/documentMetadataDisplay.ts:35`, `server/services/confirmAnalysisService.ts:46-47`, all `TS6133`) — confirmed unrelated by grepping the error output for any file this plan touched (none present). `npm run lint` reports the same 22 pre-existing problems (18 errors, 4 warnings) across unrelated `server/`/`shared/`/`src/` files; explicit `npx eslint` on all files created/modified by this plan returns zero issues. `npm test` reports 1289 tests / 1267 pass / 22 fail — the 22 failures are all pre-existing baseline issues (auth cache clearing, document sharing/trash Mongo persistence, Vision OCR, dev-server route registration, etc.) with no overlap with i18n/sidebar/nav/constants/providers files; confirmed by diffing the failure list before and after this plan's changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 01 (Fundação i18n + detecção de locale) is now functionally complete: the i18next singleton (01-02) is wired into the running app (01-03), `<html lang>` tracks the active locale dynamically, and the app shell/navigation render through `t()` in all three languages.
- No language selector UI exists yet (explicitly out of scope per plan — deferred to Phase 2).
- Remaining app surfaces (auth/cadastro, biblioteca, viewer) still use hardcoded Portuguese strings — translation is intentionally incremental per STATE.md's scope decision and is expected to continue in later phases/milestones.
- `SidebarStoragePanel`'s pluralized document-count and percentage strings remain hardcoded Portuguese; a future plan should author matching `common`/`nav` keys (with pluralization rules per locale) if full storage-panel translation is prioritized.

---
*Phase: 01-funda-o-i18n-detec-o-de-locale*
*Completed: 2026-07-17*

## Self-Check: PASSED

- FOUND: src/i18n/useDocumentLang.ts
- FOUND: src/app/providers.tsx
- FOUND: src/lib/constants.ts
- FOUND: src/components/layout/Sidebar.tsx
- FOUND: src/components/layout/SidebarNavItem.tsx
- FOUND: src/components/layout/WorkspaceTopBar.tsx
- FOUND: src/components/layout/SidebarStoragePanel.tsx
- FOUND: tests/i18n-shell-nav.test.ts
- FOUND commit: 428a77d
- FOUND commit: ffbdf95
- FOUND commit: 6240508
