import type { MetadataDisplayField } from '../types';
import {
  canonicalizeMetadataKey,
  resolveMetadataLabel,
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

function fieldLabelFromRaw(key: string, value: unknown): string | null {
  if (typeof value === 'object' && value !== null && 'label' in value) {
    const label = (value as { label?: unknown }).label;
    if (typeof label === 'string' && label.trim()) return label.trim();
  }
  return null;
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
