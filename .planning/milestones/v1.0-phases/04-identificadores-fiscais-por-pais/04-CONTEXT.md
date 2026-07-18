# Phase 4: Identificadores fiscais por país - Context

**Gathered:** 2026-07-17
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Um registro de identificadores por país substitui o `taxId.ts` BR-only, cobrindo pessoa física e
pessoa jurídica para BR (CPF/CNPJ), PY (CI/RUC) e US (SSN/EIN) com rótulo, máscara, placeholder,
normalização e validação. Os formulários de cadastro (individual e empresa) selecionam o país e
exibem o campo correto; a revisão exibe o documento formatado por país, mascarando o ID pessoal.
Requisitos: DOC-01..DOC-05.

Fora desta fase: telefone por país (Fase 5). Sync do documento/validação no `doqyn-auth-service`
(repo irmão) — ver nota de backend abaixo.
</domain>

<decisions>
## Implementation Decisions

### Locked — modelo de dados
- Novo registro `src/lib/identifiers/countryIdentifiers.ts`:
  - `type CountryCode = 'BR' | 'PY' | 'US'`.
  - `type PersonType = 'individual' | 'company'` (individual → doc pessoa física; company → doc pessoa jurídica).
  - `type IdentifierSpec = { code: string; labelKey: string; format(raw): string; placeholder: string; normalize(raw): string; isComplete(raw): boolean; validate(raw): boolean; inputMode: 'numeric' | 'text' }`.
  - `COUNTRY_IDENTIFIERS: Record<CountryCode, Record<PersonType, IdentifierSpec>>`.
  - `getIdentifierSpec(country, personType): IdentifierSpec`.
  - `SUPPORTED_COUNTRIES: CountryCode[]` = ['BR','PY','US'] com labelKey por país.
  - `defaultCountryForLocale(locale): CountryCode` — pt-BR→BR, es-PY→PY, en-US→US (usa o locale ativo do i18n).
- `normalize` retorna apenas dígitos (numérico) para todos; `toApiValue` = normalize (backend recebe dígitos).

### Regras de identificador (autoritativas)
- **BR** (preservar comportamento atual — DOC-02):
  - individual = **CPF**: 11 dígitos. `format` = `formatCpf` existente (`000.000.000-00`). `isComplete` = 11 dígitos (mantém regra atual baseada em comprimento). `validate` = dígitos verificadores CPF (mód. 11) — pode ser adicionado como validação extra sem alterar `isComplete`.
  - company = **CNPJ**: 14 dígitos. `format` = `formatCnpj` (`00.000.000/0000-00`). `isComplete` = 14 dígitos. `validate` = DV CNPJ (mód. 11).
  - Reusar `src/lib/identifiers/taxId.ts` (formatCpf/formatCnpj) — a spec BR delega a essas funções. Manter os exports atuais de `taxId.ts` funcionando (backward-compat: `TaxIdInput`, access-request, etc. continuam usando CPF/CNPJ).
- **PY**:
  - individual = **CI (Cédula de Identidad)**: numérica, 6–8 dígitos (até 9). `format` = agrupamento com pontos de milhar (ex.: `1.234.567`). `placeholder` `1.234.567`. `isComplete` = ≥6 dígitos. `validate` = ≥6 e ≤9 dígitos (nível de formato; sem DV padrão de exibição).
  - company = **RUC (Registro Único de Contribuyentes)**: base numérica (8 dígitos p/ empresa) + `-` + **dígito verificador (mód. 11, base 11)**. `format` `NNNNNNNN-D`. `placeholder` `80012345-6`. `isComplete` = base + DV presentes. `validate` = recomputar DV mód. 11 e comparar. Documentar o algoritmo mód. 11 no código.
- **US**:
  - individual = **SSN**: `XXX-XX-XXXX` (9 dígitos). `placeholder` `123-45-6789`. `isComplete` = 9 dígitos. `validate` = formato + regras: área ≠ `000`, `666`, e não `900–999`; grupo ≠ `00`; série ≠ `0000`.
  - company = **EIN**: `XX-XXXXXXX` (9 dígitos). `placeholder` `12-3456789`. `isComplete` = 9 dígitos. `validate` = 9 dígitos no formato `NN-NNNNNNN` (nível de formato).

### UI / integração
- Componente `src/components/ui/DocumentIdInput.tsx` (country-aware): props `{ country, personType, value, onChange }`; usa `getIdentifierSpec` para format/placeholder/validation, reusando `useFormattedInput` como o `TaxIdInput` atual. `TaxIdInput` (BR CPF/CNPJ) permanece para os callers existentes (access-request), ou é reimplementado sobre a spec BR sem mudar sua API.
- Seletor de país: `src/components/ui/CountrySelect.tsx` (ou reusar `Select.tsx`) listando SUPPORTED_COUNTRIES com labels i18n (Brasil/Paraguai/Estados Unidos) e bandeira/código opcional. Default = `defaultCountryForLocale(localeAtivo)`.
- Cadastro individual (`IndividualSignupPage.tsx`, `individualSignupReview.ts`): adicionar `CountrySelect` (personType fixo = individual) e trocar o `TaxIdInput kind="CPF"` por `DocumentIdInput country personType="individual"`. Rótulo dinâmico (CPF/CI/SSN). Payload envia dígitos normalizados.
- Cadastro empresa (`CompanySignupPage.tsx`, `companySignupReview.ts`): idem com personType = company (CNPJ/RUC/EIN).
- `src/lib/reviewDisplay.ts`: generalizar `formatDocument`/`formatDocumentForReview` para `(value, country, personType)`; manter mascaramento do ID pessoal (como o CPF hoje: `123.***.***-45` — aplicar mascaramento equivalente para CI/SSN). Manter assinaturas antigas com overload/compat p/ callers BR existentes.
- Rótulos i18n: adicionar chaves (país e nomes de documento) nos catálogos `common` (ou novo namespace `identifiers`) para pt-BR/es-PY/en-US.

### Nota de backend (cross-repo, deferida)
O payload de cadastro envia `taxId` como dígitos. A validação/armazenamento de documentos não-BR vive no `doqyn-auth-service` (repo irmão, fora do escopo desta milestone — sync deferido). Esta fase entrega a camada CLIENTE (registro + UI + revisão). Se o auth-service rejeitar documentos não-CPF/CNPJ, isso é um follow-up cross-repo (registrar como deferido, não bloquear).

### Claude's Discretion
Nome exato dos componentes/arquivos, se `CountrySelect` reusa `Select.tsx`, formato de agrupamento do CI (pontos vs. espaços), e se `validate` de CPF/CNPJ BR é ativado no gate de completude ou fica como validação adicional (preferir NÃO alterar o gate atual de BR).
</decisions>

<code_context>
## Existing Code Insights

- `src/lib/identifiers/taxId.ts` — `TaxIdKind='CPF'|'CNPJ'`, `formatCpf/formatCnpj/formatTaxId/isCompleteTaxId/taxIdPlaceholder/normalizeTaxId/toTaxIdApiValue`. `digits.ts` tem `extractDigits`. `index.ts` reexporta.
- `src/components/ui/TaxIdInput.tsx` — usa `useFormattedInput`, `formatTaxId(kind)`, `isCompleteTaxId(kind)`, `taxIdPlaceholder(kind)`; erro `"${kind} incompleto."`.
- `src/lib/reviewDisplay.ts` — `formatDocument(value, kind)`, `formatDocumentForReview(value, kind)` (mascara CPF, formata CNPJ inteiro).
- Callers: `individualSignupReview.ts` (CPF), `companySignupReview.ts` (CNPJ), `access-request/requestAccessReview.ts` + `RequestAccessPage.tsx` (usa `taxIdKind` dinâmico CPF/CNPJ — manter funcionando).
- Signup pages: `IndividualSignupPage.tsx` (state `taxId`, `TaxIdInput kind="CPF"`), `CompanySignupPage.tsx` (`TaxIdInput kind="CNPJ"`).
- Locale ativo: `getActiveLocale()` de `src/lib/formatLocale.ts`; `useLocale()` de `src/i18n/useLocale.ts`; tradução via `useTranslation`.
- Primitivos: `src/components/ui/Select.tsx`, `Input.tsx`, `useFormattedInput` (`src/hooks/useFormattedInput.ts`).
- Testes: Node built-in runner via `npx tsx --test`.
</code_context>

<specifics>
## Specific Ideas

- Testes em `tests/`: validação/format por país (CPF/CNPJ DV; RUC mód.11 DV com casos válidos/ inválidos; CI comprimento; SSN regras de área/grupo/série; EIN formato); `getIdentifierSpec` retorna spec certa; `defaultCountryForLocale` mapeia locais; mascaramento de ID pessoal na revisão.
- Preservar comportamento BR: um teste garantindo que CPF/CNPJ formatam/completam como antes (regressão).
</specifics>

<deferred>
## Deferred Ideas

- Telefone por país → Fase 5.
- Aceitação/validação de documentos não-BR no `doqyn-auth-service` (backend, cross-repo) — deferido.
</deferred>
