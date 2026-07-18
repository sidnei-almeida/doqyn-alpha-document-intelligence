# Phase 3: Formatação sensível a locale - Context

**Gathered:** 2026-07-17
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Datas, horas e números são formatados pelo locale ATIVO através de um util/hook central; os ~20
usos hardcoded de `'pt-BR'` migram para ele, sem regressão visual no fluxo BR. Requisitos:
FMT-01, FMT-02, FMT-03.

Fora desta fase: identificadores/telefone por país (Fases 4/5). Não alterar valores de dados que
por acaso contenham a string 'pt-BR' (ex.: `src/features/documents/mock-data.ts` `language: 'pt-BR'` é dado, não formatação — NÃO migrar).
</domain>

<decisions>
## Implementation Decisions

### Locked
- Módulo central `src/lib/formatLocale.ts`:
  - `getActiveLocale(): SupportedLocale` — lê `i18n.language` do singleton `src/i18n/index.ts`; valida contra `SUPPORTED_LOCALES`; fallback `DEFAULT_LOCALE`. Funciona em código React e não-React (serviços) porque o singleton i18next é global.
  - `formatDate(value, opts?, locale?)`, `formatDateTime(value, opts?, locale?)`, `formatTime(value, opts?, locale?)` — via `Intl.DateTimeFormat`, usando `locale ?? getActiveLocale()`.
  - `formatNumber(value, opts?, locale?)` — via `Intl.NumberFormat`.
  - `localeCompareActive(a, b, locale?)` — `a.localeCompare(b, locale ?? getActiveLocale())`.
- Manter as MESMAS opções de `Intl` já usadas em cada call site (day/month/year/hour/minute etc.) para não mudar o formato em pt-BR. Em pt-BR a saída deve ser byte-idêntica à atual.
- `src/lib/utils.ts` `formatDate` passa a delegar ao módulo central (mantendo a mesma assinatura/opções atuais: day/month/year/hour/minute 2-digit) para não quebrar chamadas existentes.
- Hook React `useLocaleFormatters()` (usa `useTranslation` para re-renderizar no `languageChanged`) retornando `{ formatDate, formatDateTime, formatTime, formatNumber, locale }` ligados ao locale ativo. Componentes que precisam re-renderizar ao trocar idioma usam o hook; utils/serviços fora do React chamam as funções puras (leem `i18n.language` no momento da chamada).

### Migration set (20 sites)
Migrar todos para o util central (mantendo opções Intl atuais):
- `src/lib/utils.ts` (formatDate — delega)
- `src/features/document-send/utils/workflowLogHelpers.ts`, `historyFormat.ts`
- `src/features/document-send/DocumentSendPage.tsx`, `hooks/useBulkUploadQueue.ts`, `services/analyzePdf.ts`, `services/processDocumentWithAI.ts`
- `src/features/sharing/components/ShareDocumentModal.tsx` (2 usos)
- `src/features/document-update-version/utils/documentMetadataDisplay.ts`
- `src/features/library/utils/sortDocuments.ts` (4 usos de localeCompare)
- `src/features/signature/components/SignaturesAssignedPanel.tsx`, `utils/signatureSummaryDisplay.ts`, `SignaturePortalPage.tsx`, `InternalSignaturePage.tsx`
- `src/features/external-share/ExternalSharePortalPage.tsx`

### Claude's Discretion
Assinaturas exatas das funções, se `sortDocuments` recebe locale por parâmetro (dado que roda em ordenação; pode ler o ativo). Portais públicos (Signature/ExternalShare) leem o locale ativo do singleton — comportamento aceitável.
</decisions>

<code_context>
## Existing Code Insights

- i18n singleton: `src/i18n/index.ts` (default export do i18next `i18n`). `i18n.language` é o locale ativo. `src/i18n/config.ts` tem `SUPPORTED_LOCALES`, `DEFAULT_LOCALE`, `SupportedLocale`.
- `src/lib/utils.ts` já concentra `formatDate` (Intl.DateTimeFormat 'pt-BR' com day/month/year/hour/minute) e `formatFileSize` (não-locale, não mexer).
- Muitos call sites usam `toLocaleDateString('pt-BR')` / `toLocaleTimeString` / `toLocaleString` / `Intl.DateTimeFormat('pt-BR', {...})` / `localeCompare(..., 'pt-BR')`.
- Testes: Node built-in runner via `npx tsx --test` (ver tests/dashboard-layout.test.ts).
</code_context>

<specifics>
## Specific Ideas

- Testes em `tests/`: `formatDate/formatDateTime/formatNumber` produzem string esperada para pt-BR (idêntica à atual), es-PY e en-US (passando locale explícito); `getActiveLocale` faz fallback quando `i18n.language` é inesperado.
- Cuidado com o TZ/valores fixos nos testes (usar datas fixas UTC e opções timeZone quando necessário para determinismo).
</specifics>

<deferred>
## Deferred Ideas

- Identificadores fiscais por país → Fase 4.
- Telefone por país → Fase 5.
</deferred>
