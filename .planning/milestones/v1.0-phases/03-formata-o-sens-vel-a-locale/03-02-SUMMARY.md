---
phase: 03-formata-o-sens-vel-a-locale
plan: 02
status: complete
completed_at: 2026-07-17
requirements: [FMT-01, FMT-03]
---

# Plan 03-02 Summary — Migrate document-send / sharing / version formatting

**Note:** Started by a gsd-executor subagent that was interrupted by a session usage limit after migrating the 6 `document-send` files (uncommitted). The orchestrator verified those edits, completed the two remaining files, added the guard test, and committed the plan.

## What was built
Migrated 8 files from hardcoded `'pt-BR'` date/time formatting to the central `@/lib/formatLocale` API (active-locale aware, byte-identical pt-BR output):

- `src/features/document-send/utils/workflowLogHelpers.ts` — `formatTime`
- `src/features/document-send/utils/historyFormat.ts` — `formatDate` + `formatTime`
- `src/features/document-send/DocumentSendPage.tsx` — `formatDate` + `formatTime`
- `src/features/document-send/hooks/useBulkUploadQueue.ts` — `formatDate` + `formatTime`
- `src/features/document-send/services/analyzePdf.ts` — `formatDate` + `formatTime` (non-React service reads i18n.language at call time)
- `src/features/document-send/services/processDocumentWithAI.ts` — `formatDate` (bare → native delegation)
- `src/features/sharing/components/ShareDocumentModal.tsx` — `formatDate` (expiresAt) + `formatDateTime` (lastAccessAt)
- `src/features/document-update-version/utils/documentMetadataDisplay.ts` — `formatDate(d, { day/month/year 2-digit, timeZone:'UTC' })` replacing the module-level `DATE_ONLY` Intl formatter

`src/features/documents/mock-data.ts` `language: 'pt-BR'` left untouched (data value, not formatting).

## Byte-identity
Bare `toLocaleDateString('pt-BR')`/`toLocaleString('pt-BR')` sites map to opts-omitted `formatDate`/`formatDateTime`, which delegate to the native `toLocale*` methods — pt-BR output is unchanged. Option-bearing sites preserve their exact Intl option sets (including `timeZone:'UTC'`).

## Verification
- `grep "'pt-BR'"` across the 8 files → none remain.
- `tests/format-locale-migration-send.test.ts` → 16/16 pass (asserts each file imports `@/lib/formatLocale` and contains no hardcoded pt-BR formatting substrings).
- `tsc -p tsconfig.app.json`: the only error in these files is a pre-existing TS6133 (`fieldLabelFromRaw`'s unused `key`) that predates and is unrelated to this migration (part of the documented baseline).

## Commits
- `feat(03-02): migrate document-send/sharing/version formatting to formatLocale`

## Deviations
Completed via orchestrator after subagent interruption (see note). No scope change.
