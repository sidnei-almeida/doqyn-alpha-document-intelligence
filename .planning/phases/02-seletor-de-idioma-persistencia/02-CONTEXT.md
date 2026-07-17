# Phase 2: Seletor de idioma + persistência - Context

**Gathered:** 2026-07-17
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Usuário pode trocar o idioma por um seletor no header e nas Configurações; a escolha persiste
entre sessões (localStorage) e sobrepõe a auto-detecção do navegador; a troca reflete
imediatamente sem reload. Requisitos: SEL-01, SEL-02, SEL-03.

Fora desta fase: formatação de data/número (Fase 3), identificadores/telefone por país (Fases 4/5),
sync do idioma no perfil do auth-service (deferido).
</domain>

<decisions>
## Implementation Decisions

### Locked
- Persistência: chave em localStorage (ex.: `doqyn.locale`), lida na inicialização do i18n com PRECEDÊNCIA sobre a detecção do navegador. Se não houver preferência salva, cai na detecção existente (`resolveSupportedLocale`).
- A leitura da preferência deve entrar em `src/i18n/index.ts` (init): initial `lng` = preferência salva válida ?? locale detectado.
- Util de persistência: `src/i18n/localePreference.ts` com `getStoredLocale()` / `setStoredLocale(locale)` (valida contra `SUPPORTED_LOCALES`, ignora valores inválidos), espelhando o padrão de `src/features/library/utils/libraryDefaultView.ts` (localStorage try/catch).
- Trocar idioma = `i18n.changeLanguage(locale)` + `setStoredLocale(locale)`; o `useDocumentLang` da Fase 1 já sincroniza `<html lang>` no evento `languageChanged`, então a troca reflete sem reload.
- Hook `useLocale()` (ou similar) expondo `{ locale, setLocale, supportedLocales }` para os componentes de UI.
- Rótulos dos idiomas: Português, Español, English (nomes nativos), com bandeira/ícone opcional. Chaves de i18n no namespace `common` (ex.: `language.pt-BR`, `language.es-PY`, `language.en-US`, `language.label`).

### UI placement
- Configurações: adicionar controle de idioma em `PreferencesSettingsSection.tsx`, reusando o padrão de segmented-control já usado para tema/visualização (SettingsRow + opções).
- Header: adicionar um item/seção de idioma no `HeaderUserMenu` (popover `AnchoredPopover`), ao lado do `ThemeToggle`. Reusar `Select.tsx`/`DropdownMenuItem` conforme couber.

### Claude's Discretion
Formato exato do controle no header (submenu vs. select inline), ícones/bandeiras, nomes de arquivos dos componentes.
</decisions>

<code_context>
## Existing Code Insights

- i18n runtime da Fase 1: `src/i18n/index.ts` (init i18next), `src/i18n/config.ts` (`SUPPORTED_LOCALES`, `DEFAULT_LOCALE`, `SupportedLocale`, `resolveSupportedLocale`), `src/i18n/useDocumentLang.ts` (sync `<html lang>`).
- Padrão de preferência local: `src/features/library/utils/libraryDefaultView.ts` (get/set em localStorage com try/catch).
- Preferências UI: `src/features/settings/components/sections/PreferencesSettingsSection.tsx` (segmented control p/ tema e visualização, `SettingsCard`/`SettingsRow`).
- Header: `src/components/layout/HeaderUserMenu.tsx` (usa `AnchoredPopover`, inclui `ThemeToggle`); `src/components/ui/ThemeToggle.tsx` é um bom análogo de toggle persistido.
- Primitivos: `src/components/ui/Select.tsx`, `src/components/ui/DropdownMenuItem.tsx`, `src/components/ui/popover/AnchoredPopover.tsx`.
- Tradução já disponível via `useTranslation` (react-i18next) em componentes do shell.
</code_context>

<specifics>
## Specific Ideas

- `src/i18n/localePreference.ts` — get/set persistência (localStorage), validação contra SUPPORTED_LOCALES.
- Ajustar `src/i18n/index.ts` para initial `lng = getStoredLocale() ?? resolveSupportedLocale(navigator.languages)`.
- `src/i18n/useLocale.ts` — hook `{ locale, setLocale, supportedLocales }` (setLocale chama changeLanguage + setStoredLocale).
- `LanguageSelect`/`LanguageSwitcher` component reusável para header + settings.
- Adicionar chaves `language.*` nos catálogos `common` dos 3 locales.
- Testes em `tests/`: (1) precedência da preferência salva sobre detecção (unidade sobre a lógica de resolução de initial locale); (2) get/set validando valores inválidos.
</specifics>

<deferred>
## Deferred Ideas

- Sync do idioma no perfil do usuário (auth-service) — deferido.
- Formatação de data/número por locale → Fase 3.
</deferred>
