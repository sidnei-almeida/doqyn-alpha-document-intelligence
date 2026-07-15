import type { ExtractedMetadataField } from '../types/documentAi.types.js';
import { projectDocumentSearchMeta } from '../../services/confirm/projectSearchMeta.js';

function fieldHasValue(field: ExtractedMetadataField | undefined): boolean {
  if (!field) return false;
  const raw = field.normalizedValue ?? field.value;
  if (raw == null) return false;
  if (typeof raw === 'string') return raw.trim().length > 0;
  return true;
}

function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Após a extração Groq: se houver âncora + prazo, grava `data_validade` calculada.
 * Não inventa âncora a partir de upload/hoje.
 */
export function enrichMetadataWithInferredValidity(
  metadata: Record<string, ExtractedMetadataField>,
): Record<string, ExtractedMetadataField> {
  const projected = projectDocumentSearchMeta(metadata);
  const out: Record<string, ExtractedMetadataField> = { ...metadata };

  if (!projected.validityDate) return out;

  const absoluteKeys = ['data_validade', 'vigencia_fim', 'data_vencimento'] as const;
  if (absoluteKeys.some((key) => fieldHasValue(out[key]))) {
    return out;
  }

  const inferredEntry = projected.dates.find(
    (entry) => entry.kind === 'validade' && /inferido/i.test(entry.label ?? ''),
  );
  const isoDay = toIsoDay(projected.validityDate);
  const snippet =
    inferredEntry?.label?.trim() ||
    'Calculado a partir da data âncora (assinatura/emissão) + prazo de vigência.';

  out.data_validade = {
    label: 'Validade',
    value: isoDay,
    normalizedValue: isoDay,
    confidence: 0.88,
    source: 'ai',
    evidence: {
      snippet,
    },
  };

  return out;
}
