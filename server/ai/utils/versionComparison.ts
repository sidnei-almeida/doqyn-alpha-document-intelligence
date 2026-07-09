import type { MongoVersionMetadataField } from '../../db/types.js';

export type VersionComparisonInput = {
  oldMetadata: Record<string, MongoVersionMetadataField>;
  newMetadata: Record<string, MongoVersionMetadataField>;
  oldSummary?: string | null;
  newSummary?: string | null;
  oldCategory?: string | null;
  newCategory?: string | null;
};

export type VersionComparisonResult = {
  changedFields: string[];
  addedFields: string[];
  removedFields: string[];
  riskWarnings: string[];
  sameDocumentConfidence: number;
  mainChanges: string[];
};

const PARTY_KEYS = new Set([
  'parte_reveladora',
  'parte_receptora',
  'fornecedor',
  'contratante',
  'contratada',
  'cnpj_emitente',
  'cnpj_destinatario',
]);

const DATE_KEYS = new Set([
  'data_assinatura',
  'data_emissao',
  'data_pedido',
  'vigencia_inicio',
  'vigencia_fim',
]);

const CLAUSE_KEYS = new Set(['objeto', 'clausula_objeto', 'descricao_servico']);

function fieldValue(field?: MongoVersionMetadataField): string | number | null {
  if (!field) return null;
  return field.normalizedValue ?? field.value;
}

function normalizeComparable(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
}

function describeFieldChange(key: string, oldValue: string, newValue: string): string {
  if (PARTY_KEYS.has(key)) {
    return `Parte alterada (${key}): "${oldValue}" → "${newValue}"`;
  }
  if (DATE_KEYS.has(key)) {
    return `Data alterada (${key}): ${oldValue} → ${newValue}`;
  }
  if (CLAUSE_KEYS.has(key)) {
    return `Cláusula/objeto alterado (${key})`;
  }
  return `Campo ${key} alterado: "${oldValue}" → "${newValue}"`;
}

export function compareDocumentVersions(input: VersionComparisonInput): VersionComparisonResult {
  const oldKeys = new Set(Object.keys(input.oldMetadata));
  const newKeys = new Set(Object.keys(input.newMetadata));
  const allKeys = new Set([...oldKeys, ...newKeys]);

  const changedFields: string[] = [];
  const addedFields: string[] = [];
  const removedFields: string[] = [];
  const mainChanges: string[] = [];
  const riskWarnings: string[] = [];

  for (const key of allKeys) {
    const oldField = input.oldMetadata[key];
    const newField = input.newMetadata[key];
    const oldValue = normalizeComparable(fieldValue(oldField));
    const newValue = normalizeComparable(fieldValue(newField));

    if (!oldKeys.has(key) && newValue) {
      addedFields.push(key);
      mainChanges.push(`Campo adicionado: ${key}`);
      continue;
    }

    if (!newKeys.has(key) && oldValue) {
      removedFields.push(key);
      mainChanges.push(`Campo removido: ${key}`);
      continue;
    }

    if (oldValue && newValue && oldValue !== newValue) {
      changedFields.push(key);
      mainChanges.push(describeFieldChange(key, oldValue, newValue));
    }
  }

  const oldCategory = normalizeComparable(input.oldCategory);
  const newCategory = normalizeComparable(input.newCategory);
  if (oldCategory && newCategory && oldCategory !== newCategory) {
    mainChanges.push(`Categoria alterada: ${input.oldCategory} → ${input.newCategory}`);
    riskWarnings.push('Categoria documental diferente da versão anterior.');
  }

  const oldSummary = normalizeComparable(input.oldSummary);
  const newSummary = normalizeComparable(input.newSummary);
  if (oldSummary && newSummary && oldSummary !== newSummary) {
    mainChanges.push('Resumo do documento alterado significativamente.');
  }

  if (changedFields.some((key) => PARTY_KEYS.has(key))) {
    riskWarnings.push('Partes envolvidas mudaram entre versões.');
  }

  if (removedFields.length >= 3) {
    riskWarnings.push('Muitos campos da versão anterior não aparecem na nova versão.');
  }

  let sameDocumentConfidence = 1;
  if (oldCategory && newCategory && oldCategory !== newCategory) {
    sameDocumentConfidence -= 0.35;
  }
  if (changedFields.filter((key) => PARTY_KEYS.has(key)).length >= 2) {
    sameDocumentConfidence -= 0.4;
  } else if (changedFields.some((key) => PARTY_KEYS.has(key))) {
    sameDocumentConfidence -= 0.2;
  }
  if (removedFields.length >= 4) {
    sameDocumentConfidence -= 0.25;
  }
  if (addedFields.length >= 6 && changedFields.length >= 6) {
    sameDocumentConfidence -= 0.15;
  }

  sameDocumentConfidence = Math.max(0, Math.min(1, sameDocumentConfidence));

  if (sameDocumentConfidence < 0.55) {
    riskWarnings.push(
      'Baixa confiança de continuidade documental — pode ser um documento diferente.',
    );
  }

  return {
    changedFields,
    addedFields,
    removedFields,
    riskWarnings: [...new Set(riskWarnings)],
    sameDocumentConfidence,
    mainChanges,
  };
}

export function buildMetadataSummary(
  metadata: Record<string, MongoVersionMetadataField>,
  className?: string | null,
): string {
  const parts: string[] = [];
  if (className?.trim()) {
    parts.push(`Categoria: ${className.trim()}`);
  }

  for (const key of ['parte_reveladora', 'parte_receptora', 'fornecedor', 'contratante']) {
    const value = fieldValue(metadata[key]);
    if (value) {
      parts.push(`${metadata[key]?.label ?? key}: ${value}`);
    }
  }

  for (const key of ['data_assinatura', 'data_emissao', 'valor_total', 'objeto']) {
    const value = fieldValue(metadata[key]);
    if (value) {
      parts.push(`${metadata[key]?.label ?? key}: ${value}`);
    }
  }

  return parts.join(' | ') || 'Sem metadados resumidos disponíveis.';
}
