import type { AnalyzePdfResponse } from '@/features/document-send/services/analyzePdf';
import type { DocumentDetailResponse } from '@/types/document-library';
import type { VersionComparisonLabelKey, VersionComparisonRow } from '../types';
import {
  analysisMetadataToDisplayFields,
  metadataRecordToDisplayFields,
} from './documentMetadataDisplay';
import { canonicalizeMetadataKey } from '../../../../shared/metadataKeyNormalize.ts';

function normalizeCompareValue(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * As quatro linhas fixas levam chave, e não frase: este módulo roda em teste Node, longe do
 * i18n, e a tela é que traduz. As linhas de metadado levam o rótulo que veio da extração.
 */
function buildRow(
  key: string,
  label: { label: string } | { labelKey: VersionComparisonLabelKey },
  currentValue: string,
  newValue: string,
): VersionComparisonRow {
  const changed =
    normalizeCompareValue(currentValue) !== normalizeCompareValue(newValue) &&
    currentValue !== '—' &&
    newValue !== '—';
  return { key, ...label, currentValue, newValue, changed };
}

export function buildVersionComparisonRows(input: {
  detail: DocumentDetailResponse;
  analysis: AnalyzePdfResponse;
  nextVersionLabel: string;
}): VersionComparisonRow[] {
  const doc = input.detail.document;
  const currentName = doc.currentFileName ?? doc.displayName ?? '—';
  const newName = input.analysis.recommendedFileName ?? input.analysis.originalFileName ?? '—';
  const currentCategory = doc.categoryName ?? doc.documentType ?? '—';
  const newCategory =
    input.analysis.classification.className ?? input.analysis.extraction?.documentType ?? '—';
  const currentVersion = doc.currentVersionLabel ?? doc.versionLabel ?? `v${doc.version ?? 1}`;
  const currentSummary =
    metadataRecordToDisplayFields(input.detail.metadata).find((field) =>
      /resumo|summary/i.test(field.key),
    )?.value ?? '—';
  const newSummary =
    analysisMetadataToDisplayFields(input.analysis).find((field) =>
      /resumo|summary/i.test(field.key),
    )?.value ?? '—';

  const rows: VersionComparisonRow[] = [
    buildRow('name', { labelKey: 'versionComparisonPanel.linhas.name' }, currentName, newName),
    buildRow(
      'category',
      { labelKey: 'versionComparisonPanel.linhas.category' },
      currentCategory,
      newCategory,
    ),
    buildRow(
      'version',
      { labelKey: 'versionComparisonPanel.linhas.version' },
      currentVersion,
      input.nextVersionLabel,
    ),
    buildRow(
      'summary',
      { labelKey: 'versionComparisonPanel.linhas.summary' },
      currentSummary,
      newSummary,
    ),
  ];

  const currentFields = metadataRecordToDisplayFields(input.detail.metadata);
  const newFields = analysisMetadataToDisplayFields(input.analysis);
  const newFieldMap = new Map(
    newFields.map((field) => [canonicalizeMetadataKey(field.key, field.label), field]),
  );

  for (const currentField of currentFields) {
    if (/resumo|summary/i.test(currentField.key)) continue;
    const matchKey = canonicalizeMetadataKey(currentField.key, currentField.label);
    const newField = newFieldMap.get(matchKey);
    rows.push(
      buildRow(
        `metadata:${matchKey}`,
        { label: currentField.label },
        currentField.value,
        newField?.value ?? '—',
      ),
    );
    newFieldMap.delete(matchKey);
  }

  for (const newField of newFieldMap.values()) {
    if (/resumo|summary/i.test(newField.key)) continue;
    const matchKey = canonicalizeMetadataKey(newField.key, newField.label);
    rows.push(buildRow(`metadata:${matchKey}`, { label: newField.label }, '—', newField.value));
  }

  return rows;
}
