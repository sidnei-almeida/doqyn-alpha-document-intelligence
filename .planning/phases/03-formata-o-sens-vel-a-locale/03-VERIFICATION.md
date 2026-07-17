---
phase: 03-formata-o-sens-vel-a-locale
status: passed
verified_at: 2026-07-17
verifier: orchestrator (manual, autonomous run)
---

# Phase 3 Verification — Formatação sensível a locale

**Status:** passed

| Req | Evidence | Result |
|-----|----------|--------|
| FMT-01 (data/hora via util central pelo locale ativo) | `src/lib/formatLocale.ts` (`formatDate/formatDateTime/formatTime` lêem `getActiveLocale()` do singleton i18n) + `useLocaleFormatters` hook; `src/lib/utils.ts formatDate` delega. Tests `format-locale.test.ts` (11). | ✅ |
| FMT-02 (números/ordenação pelo locale ativo) | `formatNumber` + `localeCompareActive`; `sortDocuments.ts` (4 sites) migrado para `localeCompareActive`. | ✅ |
| FMT-03 (migrar ~20 usos hardcoded 'pt-BR') | 20 sites em 15 arquivos migrados (clusters 03-02 + 03-03). `grep "'pt-BR'" src/` sem `i18n/`/`.test.` → resta apenas `mock-data.ts` (valor de dado, corretamente excluído). Guard tests: `format-locale-migration-send.test.ts` (16) + `format-locale-migration-signature.test.ts` (13). | ✅ |

## Test evidence
- `npx tsx --test tests/format-locale*.test.ts tests/i18n-*.test.ts` → **73 pass / 0 fail**.
- Full suite: 22 failing tests = documented pre-existing baseline (feat/document-chat), no new failures introduced.
- pt-BR output byte-identical (opts-omitted delegates to native `toLocale*`; option-bearing sites keep exact Intl options incl. `timeZone:'UTC'`).

## Note
Plan 03-02 was interrupted by a session usage limit mid-execution; the orchestrator verified the executor's uncommitted `document-send` migrations, completed the remaining two files (`ShareDocumentModal`, `documentMetadataDisplay`), added the guard test, and committed. No scope change.

## Baseline caveat
Pre-existing ~22 test failures + ~3 TS6133 build errors from uncommitted `feat/document-chat` work remain, all in unrelated areas. One TS6133 (`documentMetadataDisplay.ts` `fieldLabelFromRaw` unused `key`) predates this migration.

## Human verification
Nenhuma obrigatória — cobertura por testes. (Opcional: trocar idioma e conferir datas/horas em es-PY/en-US.)
