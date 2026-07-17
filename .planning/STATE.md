---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 05-01-PLAN.md
last_updated: "2026-07-17T23:12:33.656Z"
last_activity: 2026-07-17
progress:
  total_phases: 5
  completed_phases: 4
  total_plans: 15
  completed_plans: 12
  percent: 80
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-17)

**Core value:** Tenants can securely upload, analyze, and manage documents — expandindo para múltiplos países.
**Current focus:** Phase 5 — Telefone por país + integração no cadastro

## Current Position

Phase: 5 (Telefone por país + integração no cadastro) — EXECUTING
Plan: 2 of 4
Status: Ready to execute
Last activity: 2026-07-17

Progress: [████████░░] 80%

## Accumulated Context

### Decisions

- Expansão para Paraguai (es-PY) e Estados Unidos (en-US), mantendo Brasil (pt-BR) como fallback.
- Runtime de i18n escolhido: `react-i18next` (padrão, robusto, integra com React 19).
- Idioma persiste em localStorage nesta milestone; sync com perfil no `doqyn-auth-service` fica deferido.
- Identificadores por país: BR CPF/CNPJ, PY CI/RUC, US SSN/EIN. Telefone: BR +55, PY +595, US +1 (E.164).
- Escopo de tradução v1: shell/navegação, autenticação/cadastro, biblioteca, visualizador — tradução total é incremental.
- Executando em modo autônomo com `skip_discuss=true` e `ui_phase=false` (sem interrupções ao usuário).
- [Phase 1]: i18n detection: primeiro idioma reconhecido na lista vence (es/en/pt por primary subtag, case-insensitive), fallback pt-BR.
- [Phase 1]: i18n import convention: src/ frontend modules use no explicit .js extension on relative imports (e.g. ./config), unlike server/api code
- [Phase 1]: src/i18n/index.ts guards navigator.languages before calling resolveSupportedLocale, falling back to DEFAULT_LOCALE when navigator is unavailable; resolveSupportedLocale itself stays DOM-free
- [Phase 1]: useDocumentLang syncs document.documentElement.lang via i18next languageChanged; invoked from an inner LangSync component inside I18nextProvider (outermost provider)
- [Phase 1]: Nav items migrated from label to labelKey (nav namespace reference) resolved via t(item.labelKey); no new catalog keys needed, all resolved from 01-02 catalogs
- [Phase 2]: Stored locale preference (doqyn.locale) takes precedence over browser auto-detection at i18next init (SEL-02)
- [Phase 2]: useLocale decouples from the i18next singleton, obtaining the instance via useTranslation() to match useDocumentLang
- [Phase 2]: language.* native-name values are identical across all three catalogs; only language.label is localized per language
- [Phase 2]: LanguageSelect is presentation-only; all locale state/side effects flow through useLocale (no direct localStorage/i18n calls in the component)
- [Phase 2]: Header popover uses a stacked label-above-control layout for the language row (w-56 too narrow for inline three-language labels)
- [Phase 03]: getActiveLocale validates i18n.language against SUPPORTED_LOCALES, falls back to DEFAULT_LOCALE (pt-BR)
- [Phase 03]: Date/time formatters delegate to native toLocale*(locale) when opts omitted (byte-identity), Intl.DateTimeFormat(locale, opts) otherwise
- [Phase 03]: Root tsconfig.json now declares baseUrl/paths for @/* so tsx (npm test) resolves aliases at runtime, matching tsconfig.app.json
- [Phase 03]: sortDocuments keeps no locale parameter — localeCompareActive resolves the active locale internally at call time
- [Phase 03]: Public portal date helpers (SignaturePortalPage/InternalSignaturePage/ExternalSharePortalPage) stay module-scope reading the active i18n locale, acceptable per CONTEXT discretion
- [Phase 04]: BR isComplete stays length-based; validate() (mod-11 DV) is additive and never gates completeness for CPF/CNPJ
- [Phase 04]: PY RUC validate recomputes mod-11 base-11 check digit over 8 base digits; US SSN validate enforces SSA area/group/serial rules, EIN validate is format-only
- [Phase 04]: [Phase 04-02] formatDocument/formatDocumentForReview overloads narrow on disjoint TaxIdKind/CountryCode literal unions to keep BR-only callers compiling unchanged
- [Phase 04]: [Phase 04-02] PY CI review masking duplicates a small thousands-grouping helper locally in reviewDisplay.ts rather than exporting countryIdentifiers.ts internals
- [Phase 04]: [Phase 04-03] Document field label uses getIdentifierSpec(country, personType).code (plain string) instead of a translated labelKey
- [Phase 04]: [Phase 04-03] CountrySelect label kept as hardcoded 'País' string, consistent with existing field label convention
- [Phase 05]: formatBrazilianPhone made additive export from whatsapp.ts to reuse BR formatting in phone.ts without duplicating logic
- [Phase 05]: PHONE_COUNTRIES registry (BR/PY/US) mirrors Phase 4 COUNTRY_IDENTIFIERS shape: dialCode/placeholder/nationalLengths/format

### Pending Todos

- Executar as 5 fases da milestone i18n autonomamente.

### Blockers/Concerns

- Nenhum bloqueio conhecido. Ponto de atenção: validação de dígito verificador de RUC (PY) e regras de SSN/EIN (US) devem ser de formato, sem depender de serviços externos.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Product | Milestone "Viewer — Detalhes com metadados standard" (VIEW-01..06) | deferred | 2026-07-17 |
| Product | Exclusive Documento ↔ Ficha viewer mode | deferred | 2026-07-15 |
| Infra | Audit P1 hardening | deferred | 2026-07-15 |
| i18n | Persistir idioma no perfil do usuário (auth-service) | deferred | 2026-07-17 |
| i18n | Tradução 100% do app (superfícies restantes) | deferred | 2026-07-17 |

## Session Continuity

Last session: 2026-07-17T23:12:33.645Z
Stopped at: Completed 05-01-PLAN.md
Resume file: None
