---
phase: 01-funda-o-i18n-detec-o-de-locale
status: passed
verified_at: 2026-07-17
verifier: orchestrator (manual, autonomous run)
---

# Phase 1 Verification — Fundação i18n + detecção de locale

**Status:** passed

## Goal-backward check

Goal: app carrega via runtime i18n com catálogos pt-BR/es-PY/en-US; detecção do navegador na 1ª visita (fallback pt-BR); `<html lang>` dinâmico; shell/nav migrados a `t()`.

| Req | Evidence | Result |
|-----|----------|--------|
| I18N-01 (runtime + provider) | `react-i18next`/`i18next`/`i18next-browser-languagedetector` in package.json; `src/i18n/index.ts` singleton; `I18nextProvider` wraps tree in `src/app/providers.tsx`. Test `i18n-shell-nav.test.ts` asserts provider wiring. | ✅ |
| I18N-02 (catalogs, 3 locales, fallback pt-BR) | `src/i18n/locales/{pt-BR,es-PY,en-US}/{common,nav}.json`; `i18n-catalogs.test.ts` enforces key parity + pt-BR fallback. | ✅ |
| I18N-03 (browser detection → supported locale, fallback) | `resolveSupportedLocale` in `src/i18n/config.ts`; `i18n-locale-detection.test.ts` — 7 assertions (es/en/pt/unknown/empty/precedence/case). | ✅ |
| I18N-04 (`<html lang>` dynamic) | `src/i18n/useDocumentLang.ts` syncs `document.documentElement.lang` on `languageChanged`; test asserts the sync. | ✅ |
| Shell/nav migrated to `t()` | `src/lib/constants.ts` (labelKey), `Sidebar.tsx`, `SidebarNavItem.tsx`, `WorkspaceTopBar.tsx`, `SidebarStoragePanel.tsx`; `i18n-shell-nav.test.ts` asserts no hardcoded PT nav labels + `useTranslation` usage. | ✅ |

## Test evidence

- i18n suite: `npx tsx --test tests/i18n-locale-detection.test.ts tests/i18n-catalogs.test.ts tests/i18n-shell-nav.test.ts` → **17 pass / 0 fail**.

## Baseline caveat (out of scope)

The working tree carries pre-existing uncommitted work from `feat/document-chat` (dashboard redesign, chat, sharing, thumbnail cache) that produces ~22 failing tests and ~3 TS6133 build errors **independent of this milestone**. Verified by stashing i18n files (plan 01-02) and by inspecting the failing set — every failure is in an unrelated feature area (login/session cache, dashboard overview, external sharing, favorites, move, signatures, OCR/Vision, thumbnail cache, groq pipeline, OG). No failing test references i18n/locale/nav/sidebar. Phase 1 introduced **no new regressions**. These pre-existing issues are logged in `deferred-items.md` and belong to the separate `feat/document-chat` work, not this milestone.

## Human verification

None required — foundation is code + unit-test verifiable and fully covered above.
