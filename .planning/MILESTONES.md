# Milestones

## v1.0 Internacionalização e multi-país (BR/PY/US) (Shipped: 2026-07-18)

**Phases completed:** 5 phases, 15 plans, 37 tasks

**Key accomplishments:**

- Installed react-i18next/i18next/i18next-browser-languagedetector and added a DOM-free `resolveSupportedLocale()` mapping (es/en/pt -> es-PY/en-US/pt-BR, pt-BR fallback), unit-tested with 7 passing assertions.
- Six flat-key JSON catalogs (pt-BR/es-PY/en-US x common/nav) plus a single i18next singleton initialized with pt-BR fallback and detection-driven initial language via `resolveSupportedLocale(navigator.languages)`.
- App wrapped in I18nextProvider with a `<html lang>` sync hook, and Sidebar/TopBar/SidebarStoragePanel migrated off hardcoded Portuguese strings onto `t()` calls against the `nav`/`common` namespaces (all keys already authored in plan 01-02).
- Reusable segmented-control LanguageSelect component mounted in both the header account popover and Settings > Preferences, switching the UI language live via useLocale with no page reload.
- Added `formatLocale.ts` + `useLocaleFormatters` hook reading the active i18n locale via `getActiveLocale()`, with `utils.ts formatDate` now delegating to it while staying byte-identical in pt-BR.
- Migrated the last hardcoded `'pt-BR'` usages — 4 `localeCompare` calls in library document sort plus 5 signature/external-share date displays — onto the central `formatLocale` module (`localeCompareActive`/`formatDate`/`formatDateTime`), preserving exact sort operands and Intl options for byte-identical pt-BR output.
- Country identifier registry (`countryIdentifiers.ts`) covering BR CPF/CNPJ, PY CI/RUC, US SSN/EIN with format/validate/completeness per person type, plus additive mod-11 check-digit validators for CPF/CNPJ.
- Country-aware `DocumentIdInput`/`CountrySelect` components plus a generalized `reviewDisplay` (BR/PY/US masking via `getIdentifierSpec`) with backward-compatible overloads for existing BR signup/access-request callers, and `identifiers` i18n catalogs for all three locales.
- Individual and company signup now pick a country (defaulting from the active locale), render the correct personal/company document field (CPF/CI/SSN, CNPJ/RUC/EIN) via `DocumentIdInput`, send normalized digits in the payload, and format/mask the review section per country.
- Country-aware `phone.ts` registry delivering BR/PY/US phone formatting, E.164 conversion, and completeness checks, reusing `formatBrazilianPhone` for byte-identical BR output.
- PhoneInput (DDI selector + formatted input) wired into both signup flows, payloads now send E.164 with the selected country's dial code (BR byte-identical), and review shows the phone formatted per country.
- Generalized `server/utils/contactNormalize.ts` to normalize/extract/mask E.164 phone numbers for BR (+55), PY (+595), and US (+1) without blindly prepending 55 to numbers that already carry a known dial code.
- New `auth` i18next namespace (pt-BR/es-PY/en-US) with Login, individual-signup, and company-signup pages migrated from hardcoded pt-BR strings to `t('auth:...')` calls, localizing the TEL-02 phone/country fields alongside the rest of the auth surface.

---
