import type { MetadataDisplayField } from '../types';
import type { DocumentSearchMeta } from '@/types/document-library';
import {
  canonicalizeMetadataKey,
  resolveMetadataLabel,
  STANDARD_DETAILS_KEYS,
  VALIDITY_ABSOLUTE_KEYS,
} from '../../../../shared/metadataKeyNormalize.ts';

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

function fieldLabelFromRaw(_key: string, value: unknown): string | null {
  if (typeof value === 'object' && value !== null && 'label' in value) {
    const label = (value as { label?: unknown }).label;
    if (typeof label === 'string' && label.trim()) return label.trim();
  }
  return null;
}

const DATE_ONLY = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

function formatDateOnly(value: string | Date | null | undefined): string | null {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return DATE_ONLY.format(d);
}

function formatMaybeDateValue(raw: unknown): string {
  if (raw == null || raw === '') return '—';
  if (typeof raw === 'string' || typeof raw === 'number') {
    const asDate = formatDateOnly(String(raw));
    if (asDate) return asDate;
  }
  return formatMetadataValue(raw);
}

/** Converte metadados do documento em campos legíveis para painéis de resumo. */
export function metadataRecordToDisplayFields(
  metadata: Record<string, unknown> | undefined | null,
): MetadataDisplayField[] {
  if (!metadata || Object.keys(metadata).length === 0) return [];

  const byCanonical = new Map<string, MetadataDisplayField>();

  for (const [key, value] of Object.entries(metadata)) {
    const rawLabel = fieldLabelFromRaw(key, value);
    const canonicalKey = canonicalizeMetadataKey(key, rawLabel);
    const formatted = formatMetadataValue(value);
    if (formatted === '—') continue;

    const existing = byCanonical.get(canonicalKey);
    if (existing && existing.value !== '—') continue;

    byCanonical.set(canonicalKey, {
      key: canonicalKey,
      label: resolveMetadataLabel(canonicalKey, rawLabel),
      value: formatted,
    });
  }

  return [...byCanonical.values()];
}

function canonicalMetadataMap(
  metadata: Record<string, unknown> | undefined | null,
): Map<string, unknown> {
  const map = new Map<string, unknown>();
  if (!metadata) return map;
  for (const [key, value] of Object.entries(metadata)) {
    const rawLabel = fieldLabelFromRaw(key, value);
    const canonicalKey = canonicalizeMetadataKey(key, rawLabel);
    if (!map.has(canonicalKey) || map.get(canonicalKey) == null || map.get(canonicalKey) === '') {
      map.set(canonicalKey, value);
    }
  }
  return map;
}

function resolveValidityField(
  byKey: Map<string, unknown>,
  searchMeta?: DocumentSearchMeta | null,
): MetadataDisplayField {
  let absoluteRaw: unknown;
  for (const key of VALIDITY_ABSOLUTE_KEYS) {
    if (byKey.has(key) && byKey.get(key) != null && byKey.get(key) !== '') {
      absoluteRaw = byKey.get(key);
      break;
    }
  }

  const inferredDate = searchMeta?.dates?.find(
    (entry) => entry.kind === 'validade' && /inferido/i.test(entry.label ?? ''),
  );
  const projected = searchMeta?.validityDate
    ? formatDateOnly(searchMeta.validityDate)
    : null;
  const hasPrazo =
    byKey.has('prazo_vigencia') &&
    byKey.get('prazo_vigencia') != null &&
    String(byKey.get('prazo_vigencia')).trim() !== '';

  if (absoluteRaw != null && absoluteRaw !== '') {
    return {
      key: 'validity',
      label: 'Validade',
      value: formatMaybeDateValue(absoluteRaw),
    };
  }

  if (inferredDate || (projected && hasPrazo)) {
    return {
      key: 'validity',
      label: 'Validade',
      value: formatDateOnly(inferredDate?.date) ?? projected ?? 'Não determinada',
      hint: 'Inferida (assinatura/emissão + prazo)',
    };
  }

  if (projected) {
    return {
      key: 'validity',
      label: 'Validade',
      value: projected,
    };
  }

  return {
    key: 'validity',
    label: 'Validade',
    value: 'Não determinada',
  };
}

/**
 * Ficha curated para o aside Detalhes: só campos standard + validade honesta.
 */
export function buildStandardDetailsFields(input: {
  metadata?: Record<string, unknown> | null;
  searchMeta?: DocumentSearchMeta | null;
}): MetadataDisplayField[] {
  const { metadata, searchMeta } = input;
  const byKey = canonicalMetadataMap(metadata);
  const fields: MetadataDisplayField[] = [];
  const used = new Set<string>();

  const title =
    (typeof searchMeta?.documentTitle === 'string' && searchMeta.documentTitle.trim()) ||
    formatMetadataValue(byKey.get('titulo'));
  if (title && title !== '—') {
    fields.push({ key: 'titulo', label: 'Título', value: title });
    used.add('titulo');
  }

  const people = searchMeta?.people ?? [];
  for (const person of people) {
    const roleKey = canonicalizeMetadataKey(person.role || person.sourceKey || 'pessoa');
    if (used.has(roleKey)) continue;
    const name = person.name?.trim();
    if (!name) continue;
    fields.push({
      key: roleKey,
      label: resolveMetadataLabel(roleKey),
      value: name,
    });
    used.add(roleKey);
  }

  const assinaturaFromSearch = searchMeta?.dates?.find((d) => d.kind === 'assinatura');
  if (assinaturaFromSearch && !used.has('data_assinatura')) {
    const formatted = formatDateOnly(assinaturaFromSearch.date);
    if (formatted) {
      fields.push({
        key: 'data_assinatura',
        label: 'Data de assinatura',
        value: formatted,
      });
      used.add('data_assinatura');
    }
  }

  for (const key of STANDARD_DETAILS_KEYS) {
    if (used.has(key)) continue;
    if (key === 'titulo') continue;
    if (VALIDITY_ABSOLUTE_KEYS.has(key)) continue;
    if (!byKey.has(key)) continue;
    const raw = byKey.get(key);
    const formatted =
      key.startsWith('data_') || key.startsWith('vigencia_')
        ? formatMaybeDateValue(raw)
        : formatMetadataValue(raw);
    if (formatted === '—') continue;
    fields.push({
      key,
      label: resolveMetadataLabel(key),
      value: formatted,
    });
    used.add(key);
  }

  const hasFichaSignal =
    fields.length > 0 ||
    Boolean(searchMeta?.validityDate) ||
    [...VALIDITY_ABSOLUTE_KEYS].some((k) => byKey.has(k)) ||
    byKey.has('prazo_vigencia');

  if (hasFichaSignal) {
    fields.push(resolveValidityField(byKey, searchMeta));
  }

  return fields;
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

  const byCanonical = new Map<string, MetadataDisplayField>();

  for (const [key, field] of Object.entries(metadata)) {
    const canonicalKey = canonicalizeMetadataKey(key, field.label);
    const formatted = formatMetadataValue(field.value);
    const existing = byCanonical.get(canonicalKey);
    if (existing && existing.value !== '—' && formatted === '—') continue;

    byCanonical.set(canonicalKey, {
      key: canonicalKey,
      label: resolveMetadataLabel(canonicalKey, field.label),
      value: formatted,
    });
  }

  return [...byCanonical.values()];
}

export { resolveMetadataLabel, canonicalizeMetadataKey };
