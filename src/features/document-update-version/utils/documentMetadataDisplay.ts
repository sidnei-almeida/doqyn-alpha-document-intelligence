import type { MetadataDisplayField } from '../types';

const METADATA_LABEL_OVERRIDES: Record<string, string> = {
  documentType: 'Tipo',
  tipo: 'Tipo',
  parties: 'Partes',
  parte_reveladora: 'Parte reveladora',
  parte_receptora: 'Parte receptora',
  cnpj: 'CNPJ',
  cpf: 'CPF',
  cpf_cnpj: 'CPF/CNPJ',
  data_documento: 'Data do documento',
  data_validade: 'Validade',
  resumo: 'Resumo',
  summary: 'Resumo',
  clausulas: 'Cláusulas',
  sensitivity: 'Sensibilidade',
  sensibilidade: 'Sensibilidade',
  category: 'Categoria',
  className: 'Categoria',
  recommendedFileName: 'Nome sugerido (IA)',
  aiSuggestedFileName: 'Nome sugerido (IA)',
};

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatMetadataValue(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => formatMetadataValue(entry)).join(', ');
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if ('value' in record || 'normalizedValue' in record) {
      return formatMetadataValue(record.normalizedValue ?? record.value);
    }
    if ('label' in record && 'value' in record) {
      return formatMetadataValue(record.value);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return '—';
    }
  }
  return '—';
}

/** Converte metadados do documento em campos legíveis para painéis de resumo. */
export function metadataRecordToDisplayFields(
  metadata: Record<string, unknown> | undefined | null,
): MetadataDisplayField[] {
  if (!metadata || Object.keys(metadata).length === 0) return [];

  return Object.entries(metadata)
    .map(([key, value]) => {
      const label =
        typeof value === 'object' &&
        value !== null &&
        'label' in value &&
        typeof (value as { label?: unknown }).label === 'string'
          ? String((value as { label: string }).label)
          : METADATA_LABEL_OVERRIDES[key] ?? humanizeKey(key);

      return {
        key,
        label,
        value: formatMetadataValue(value),
      };
    })
    .filter((field) => field.value !== '—');
}

export function analysisMetadataToDisplayFields(
  raw: {
    extraction?: {
      metadata?: Record<string, { label?: string; value?: unknown }>;
    } | null;
  } | null,
): MetadataDisplayField[] {
  const metadata = raw?.extraction?.metadata;
  if (!metadata) return [];

  return Object.entries(metadata).map(([key, field]) => ({
    key,
    label: field.label?.trim() || METADATA_LABEL_OVERRIDES[key] || humanizeKey(key),
    value: formatMetadataValue(field.value),
  }));
}
