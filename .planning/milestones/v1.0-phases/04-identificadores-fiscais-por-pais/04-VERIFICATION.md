---
phase: 04-identificadores-fiscais-por-pais
status: passed
verified_at: 2026-07-17
verifier: orchestrator (manual, autonomous run)
---

# Phase 4 Verification — Identificadores fiscais por país

**Status:** passed

| Req | Evidence | Result |
|-----|----------|--------|
| DOC-01 (registro por país) | `src/lib/identifiers/countryIdentifiers.ts` — `CountryCode`, `PersonType`, `IdentifierSpec` (code/labelKey/format/placeholder/normalize/isComplete/validate/inputMode), `COUNTRY_IDENTIFIERS`, `getIdentifierSpec`, `SUPPORTED_COUNTRIES`, `defaultCountryForLocale`. | ✅ |
| DOC-02 (BR sem regressão) | BR specs delegam a `formatCpf/formatCnpj`; `isComplete` mantém regra por comprimento; `validateCpf/validateCnpj` mod-11 adicionados sem alterar completude. `tests/identifier-formatters.test.ts` (BR regression) segue verde. | ✅ |
| DOC-03 (PY/US) | PY CI (agrupamento + comprimento 6–9), PY RUC (mod-11 base-11 DV, `800177266`→DV 6), US SSN (área≠000/666/900-999, grupo≠00, série≠0000), US EIN (formato NN-NNNNNNN). Cobertos por `tests/country-identifiers.test.ts`. | ✅ |
| DOC-04 (cadastro seleciona país) | `IndividualSignupPage.tsx` (personType=individual) + `CompanySignupPage.tsx` (personType=company) usam `CountrySelect` (default via `defaultCountryForLocale`) + `DocumentIdInput`; campo/rótulo dinâmicos; payload envia dígitos normalizados. | ✅ |
| DOC-05 (revisão por país + masking) | `reviewDisplay` generalizado `(value, country, personType)` com masking do ID pessoal e back-compat para callers BR; review sections dos dois cadastros formatam por país. | ✅ |

## Test evidence
- `npx tsx --test tests/country-*.test.ts tests/identifier-formatters.test.ts tests/individual-signup-review.test.ts tests/company-signup-review.test.ts` → **72 pass / 0 fail**.
- `TaxIdInput` inalterado; access-request (BR) intacto.

## Deferred (cross-repo)
Aceitação/validação de documentos não-BR no `doqyn-auth-service` (backend, repo irmão) — o cliente envia dígitos normalizados no campo `taxId` existente; o backend pode precisar aceitar CI/RUC/SSN/EIN. Registrado como follow-up cross-repo, fora do escopo desta milestone.

## Baseline caveat
Falhas pré-existentes (~22 testes, ~3 TS6133) do trabalho `feat/document-chat` permanecem, todas não relacionadas. Nenhuma regressão nova.

## Human verification
Opcional: abrir o cadastro individual/empresa, trocar o país (BR/PY/US) e confirmar rótulo/máscara/validação do documento e a formatação na revisão.
