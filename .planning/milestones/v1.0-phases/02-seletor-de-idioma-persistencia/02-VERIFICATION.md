---
phase: 02-seletor-de-idioma-persistencia
status: passed
verified_at: 2026-07-17
verifier: orchestrator (manual, autonomous run)
---

# Phase 2 Verification — Seletor de idioma + persistência

**Status:** passed

| Req | Evidence | Result |
|-----|----------|--------|
| SEL-01 (selector no header + settings) | `src/components/ui/LanguageSelect.tsx` (radiogroup catalog-driven), montado em `HeaderUserMenu.tsx` (popover, ao lado do ThemeToggle) e em `PreferencesSettingsSection.tsx`. Teste `i18n-language-selector.test.ts` (5) confirma montagem em ambas superfícies. | ✅ |
| SEL-02 (persistência localStorage sobrepõe detecção) | `src/i18n/localePreference.ts` (get/set validados) + `resolveInitialLocale`/init em `src/i18n/index.ts` com precedência da preferência salva. Teste `i18n-locale-preference.test.ts` (11) cobre precedência e valores inválidos. | ✅ |
| SEL-03 (troca reflete sem reload) | `useLocale().setLocale` → `i18n.changeLanguage` + persist; `useDocumentLang` (Fase 1) atualiza `<html lang>` no evento `languageChanged`. Sem reload. | ✅ |

## Test evidence
- `npx tsx --test tests/i18n-*.test.ts` → **33 pass / 0 fail** (6 suites).
- `tsc`/`eslint` limpos nos arquivos tocados.

## Baseline caveat
Falhas pré-existentes (~22 testes, ~3 TS6133) do trabalho não commitado `feat/document-chat` permanecem, todas em áreas não relacionadas a i18n. Nenhuma regressão nova introduzida.

## Human verification
Nenhuma obrigatória — cobertura por testes de fonte/comportamento. (Opcional: abrir o app, trocar idioma no header e recarregar para confirmar persistência visual.)
