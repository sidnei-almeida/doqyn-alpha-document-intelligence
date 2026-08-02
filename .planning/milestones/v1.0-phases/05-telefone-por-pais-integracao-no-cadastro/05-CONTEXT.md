# Phase 5: Telefone por país + integração no cadastro - Context

**Gathered:** 2026-07-17
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Entrada de telefone funciona para BR (+55), PY (+595) e US (+1) com máscara e valor E.164 corretos;
seletor de DDI/país nos formulários de cadastro, default vindo do locale/país ativo; o servidor
normaliza E.164 multi-país sem assumir +55; strings de cadastro/autenticação passam por `t()` em
pt-BR/es-PY/en-US. Requisitos: TEL-01, TEL-02, TEL-03 (+ tradução cadastro/auth = critério do ROADMAP).

Última fase da milestone. Fora: tradução total do app (incremental), sync auth-service (deferido).
</domain>

<decisions>
## Implementation Decisions

### Locked — telefone
- Reusar `CountryCode = 'BR'|'PY'|'US'` da Fase 4 (`src/lib/identifiers/countryIdentifiers.ts`). Dial codes: BR `55`, PY `595`, US `1`.
- Novo `src/lib/identifiers/phone.ts` (country-aware), SEM quebrar `src/lib/identifiers/whatsapp.ts` (14 callers BR dependem dele):
  - `PHONE_COUNTRIES: Record<CountryCode, { dialCode; placeholder; format(nationalDigits): string; nationalLengths: number[] }>`.
    - BR: dial 55, nacional DDD(2)+número(8–9) → `+55 54 99999-9999` (reusar `formatBrazilianPhone` de whatsapp.ts). placeholder `+55 54 99999-9999`.
    - PY: dial 595, celular nacional 9 dígitos (ex.: `9XX XXX XXX`) → `+595 9XX XXX XXX`. placeholder `+595 981 234 567`.
    - US: dial 1, nacional 10 dígitos → `+1 (XXX) XXX-XXXX`. placeholder `+1 (202) 555-0123`.
  - `formatPhone(rawInput, country)`, `toE164(rawInput, country)` → dígitos E.164 com dial code (ex.: BR `5511999998888`, PY `595981234567`, US `12025550123`); `toE164Plus` → `+<e164>`; `isCompletePhone(value, country)`; `defaultPhoneCountry(locale)` (pt-BR→BR, es-PY→PY, en-US→US — pode reusar `defaultCountryForLocale`).
- Componente `src/components/ui/PhoneInput.tsx` (country-aware): seletor de DDI/país (reusar `CountrySelect` ou dropdown de dial code) + input formatado (via `useFormattedInput`), produzindo E.164 do país selecionado. Default do país = `defaultCountryForLocale(localeAtivo)`. `WhatsappInput` permanece para os callers existentes.

### Integração no cadastro
- `IndividualSignupPage.tsx` e `CompanySignupPage.tsx`: trocar `WhatsappInput` por `PhoneInput` com seletor de país (default do locale). O payload envia o telefone em E.164 **com o dial code do país** — para BR isso equivale ao comportamento atual (`toWhatsappApiValue` já prefixa 55). Enviar preferencialmente com `+` (E.164) para desambiguar no servidor; se manter sem `+`, garantir que já inclui o dial code.
- Revisão (`individualSignupReview.ts`, `companySignupReview.ts` via `reviewDisplay.formatPhone`): exibir o telefone formatado E.164 do país.
- Demais callers de `WhatsappInput` (share/signature/access-request/invite) permanecem BR por ora — generalizá-los é incremental (fora do escopo desta fase).

### Servidor (TEL-03)
- `server/utils/contactNormalize.ts`: generalizar sem quebrar BR nem `tests/contact-recipient-phone.test.ts`:
  - Não prefixar `55` cegamente: `ensureBrCountryCode` → lógica que (a) respeita `+`/DDI explícito (já respeita), (b) NÃO prefixa 55 a números que já começam com um dial code conhecido (55/595/1), (c) mantém a conveniência BR (prefixa 55 só para número nacional 10–11 dígitos que não comece com dial code conhecido).
  - `extractRecipientPhoneCountryCode` e `maskRecipientPhoneForDisplay`: reconhecer 55/595/1 (não só 55). Mascaramento equivalente por país (ex.: `+595 98 *****-4567`, `+1 (202) *****-0123`).
  - `isValidWhatsapp` (10–15 dígitos E.164) permanece.
- Nota: o cliente passa a enviar o telefone com dial code do país selecionado (idealmente com `+`), então o caminho `hasExplicitDdi`/dial-code-conhecido do servidor resolve a ambiguidade de números de 11 dígitos (BR nacional vs. US `1`+10).

### Tradução cadastro/auth
- Migrar strings visíveis de `src/pages/Login.tsx`, `IndividualSignupPage.tsx`, `CompanySignupPage.tsx` para `t()` num namespace `auth` (chaves em pt-BR/es-PY/en-US). Login é tela in-app (formulário credencial condicional). Manter placeholders/labels dinâmicos já introduzidos (documento/telefone) usando i18n.
- Registrar o namespace `auth` no init do i18n (`src/i18n/index.ts`) para os 3 locais.

### Claude's Discretion
Forma exata do seletor de DDI (bandeira+código vs. nome), agrupamento dos dígitos PY/US, se `PhoneInput` reusa `CountrySelect`, e a extensão exata da tradução (cobrir os textos visíveis principais das 3 telas; textos secundários podem ficar para incremento).
</decisions>

<code_context>
## Existing Code Insights

- `src/lib/identifiers/whatsapp.ts` — BR-centric: `formatWhatsapp/formatWhatsappInput/isCompleteWhatsapp/toWhatsappApiValue`, `ensureBrCountryCode`, `formatBrazilianPhone`, `formatInternationalPhone` (já lida com +1 e outros DDIs por prefixo), `WHATSAPP_PLACEHOLDER`. Reusar `formatBrazilianPhone`.
- `src/components/ui/WhatsappInput.tsx` — usa `formatWhatsappInput`, `isCompleteWhatsapp`, `WHATSAPP_PLACEHOLDER`; erro "WhatsApp incompleto.". 14 callers no total — NÃO quebrar.
- `src/lib/reviewDisplay.ts` — `formatPhone(value)` usa `formatWhatsapp`.
- `server/utils/contactNormalize.ts` — `parseOptionalRecipientPhone` (respeita `+`), `ensureBrCountryCode` (prefixa 55 em 10–11 díg.), `extractRecipientPhoneCountryCode`/`maskRecipientPhoneForDisplay` (BR), `isValidWhatsapp` (10–15). Consumidores: sharing/signature/tenant member/access-request. Teste: `tests/contact-recipient-phone.test.ts`.
- Fase 4: `defaultCountryForLocale`, `CountrySelect`, `getIdentifierSpec`, `CountryCode`.
- `src/pages/Login.tsx` (form email/senha/remember), `src/features/individual-signup/IndividualSignupPage.tsx`, `src/features/company-signup/CompanySignupPage.tsx`.
- Locale ativo: `getActiveLocale()` / `useLocale()`. i18n init: `src/i18n/index.ts`.
- Testes: Node built-in runner via `npx tsx --test`.
</code_context>

<specifics>
## Specific Ideas

- Testes cliente: `formatPhone`/`toE164`/`isCompletePhone` por país (BR/PY/US) com exemplos concretos; `defaultPhoneCountry` por locale; regressão BR (formato `+55 54 99999-9999`, E.164 `5554999999999`).
- Testes servidor: estender `tests/contact-recipient-phone.test.ts` — BR permanece; `+595...` e `+1...` normalizam/mascaram por país; número que já começa com dial code conhecido não recebe 55; BR nacional 11 díg. ainda vira `55...`.
- Testes tradução: chaves `auth.*` presentes nos 3 locais; strings principais das telas passam por `t()`.
</specifics>

<deferred>
## Deferred Ideas

- Generalizar telefone nos demais fluxos (share/signature/invite/access-request) — incremental.
- Sync do telefone/validação no `doqyn-auth-service` (backend) — deferido.
- Tradução total do app — incremental.
</deferred>
