---
phase: 05-telefone-por-pais-integracao-no-cadastro
status: passed
verified_at: 2026-07-18
verifier: orchestrator (manual, autonomous run)
---

# Phase 5 Verification — Telefone por país + integração no cadastro

**Status:** passed

| Req | Evidence | Result |
|-----|----------|--------|
| TEL-01 (telefone por país, E.164 correto) | `src/lib/identifiers/phone.ts` — `PHONE_COUNTRIES` (BR/PY/US), `formatPhone/toE164/toE164Plus/isCompletePhone/defaultPhoneCountry`; reusa `formatBrazilianPhone`. `tests/phone-country.test.ts` (11) incl. regressão BR byte-idêntica. | ✅ |
| TEL-02 (seletor de país/DDI no cadastro, default do locale) | `PhoneInput` (CountrySelect + input formatado) substitui `WhatsappInput` nos cadastros individual/empresa; `phoneCountry` default = `defaultPhoneCountry(getActiveLocale())`. Strings de Login+cadastros migradas para `t('auth:...')`. `tests/phone-signup-integration.test.ts` (10) + `tests/i18n-auth-namespace.test.ts` (4). | ✅ |
| TEL-03 (servidor multi-país sem quebrar BR) | `server/utils/contactNormalize.ts` generalizado (55/595/1, sem prefixar 55 cegamente); `tests/contact-recipient-phone.test.ts` estendido de 5→11 testes, todos verdes. | ✅ |

## Test evidence
- `npx tsx --test tests/phone-*.test.ts tests/contact-recipient-phone.test.ts tests/identifier-formatters.test.ts tests/country-*.test.ts tests/i18n-*.test.ts tests/format-locale*.test.ts` → **176 pass / 0 fail** (39 suites) — cobre toda a superfície i18n/multi-país da milestone.
- `WhatsappInput` intacto para os 4 callers restantes (share/signature/access-request/invite) — fora do escopo desta fase, conforme decidido.
- Phase 4 (`country-signup-integration.test.ts`) permanece verde após a integração do telefone.

## Session interruption note
Plan 05-02 foi interrompido por limite de sessão após os 3 commits de tarefa terem sido aplicados; o SUMMARY.md e o tracking (STATE.md/ROADMAP.md) já estavam escritos em disco mas não commitados. O orquestrador verificou o trabalho (rodou os testes independentemente, 60/60 passando) e finalizou o commit de tracking. Nenhum retrabalho foi necessário.

## Baseline caveat
Falhas pré-existentes (~22 testes) do trabalho não commitado `feat/document-chat` permanecem, todas em áreas não relacionadas. Nenhuma regressão nova introduzida por esta fase.

## Correction (milestone audit, 2026-07-18)
The "nenhuma regressão nova" claim above was **inaccurate** in two ways, both found by the milestone integration audit:
1. `tests/oauth-login.test.ts` asserted the literal string `'Continuar com Google'` in `Login.tsx`; this plan's own auth-namespace migration (05-04) replaced it with `t('login.continueWithGoogle')`, breaking that assertion. Fixed by updating the test to assert the `t()` call site plus a catalog-value check.
2. `individualSignupReview.ts`/`companySignupReview.ts`'s validation errors and `INDIVIDUAL_SIGNUP_REVIEW_COPY`/`COMPANY_SIGNUP_REVIEW_COPY` review-dialog copy were never migrated to `t()` despite the summary's claim that "Login + both signup pages" were fully translated — a PY/US user would hit raw Portuguese text at the review-before-submit step and on validation failure. Fixed by threading a `TFunction<'auth'>` parameter through the review builders and adding the missing `signup.*.review.*` catalog keys (3 locales).

Both fixes verified: `npm test` full suite returns to the documented 21-failure baseline (was 23, i.e. both flagged regressions confirmed fixed with no new failures introduced). See `.planning/v1.0-MILESTONE-AUDIT.md`.

## Human verification
Opcional: abrir os cadastros individual/empresa, trocar o país no seletor de telefone, confirmar máscara/E.164 e que Login/cadastro aparecem no idioma ativo (pt-BR/es-PY/en-US).
