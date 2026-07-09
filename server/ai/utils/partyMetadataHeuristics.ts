import type { DocumentClassRule, ExtractedMetadataField, RetrievedChunk } from '../types/documentAi.types.js';
import { isConfidentialityClassRule } from './documentClassHeuristics.js';
import { normalizeStringFieldValue } from '../services/documentValidators.js';
import { isValidPartyName, sanitizePartyMetadataValue } from './partyNameValidation.js';

export type InferredParties = {
  parte_reveladora?: string;
  parte_receptora?: string;
};

const PARTY_LABEL_PATTERNS: Array<{ key: keyof InferredParties; pattern: RegExp }> = [
  {
    key: 'parte_reveladora',
    pattern:
      /parte\s+reveladora\s*[:,]\s*([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][^\n.;]{2,70}?)(?=\s*(?:,|\.|;|e\s+de\s+outro|parte\s+receptora|inscrit|$))/i,
  },
  {
    key: 'parte_receptora',
    pattern:
      /parte\s+receptora\s*[:,]\s*([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][^\n.;]{2,70}?)(?=\s*(?:,|\.|;|qualificad|inscrit|$))/i,
  },
  {
    key: 'parte_reveladora',
    pattern:
      /contratante\s*[:,]\s*([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][^\n.;]{2,70}?)(?=\s*(?:,|\.|;|e\s+|contratad|inscrit|$))/i,
  },
  {
    key: 'parte_receptora',
    pattern:
      /contratad[oa]\s*[:,]\s*([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][^\n.;]{2,70}?)(?=\s*(?:,|\.|;|inscrit|$))/i,
  },
];

const BOTH_PARTIES_PATTERN =
  /de\s+um\s+lado[,\s]+([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][^,;.\n]{2,70}?)[,;\s]+e\s+de\s+outro[,\s]+([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][^,;.\n]{2,70}?)(?=[,;.]|$)/i;

function cleanPartyCandidate(raw: string): string | null {
  const cleaned = raw
    .replace(/\b(?:inscrit[oa]|inscrita|inscrito)\b.*$/i, '')
    .replace(/\b(?:CPF|CNPJ)\b.*$/i, '')
    .replace(/\b(?:sediad[oa]|com\s+sede)\b.*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/^["'([]+/, '')
    .replace(/["')\]]+$/, '');

  return sanitizePartyMetadataValue(cleaned);
}

function inferPartiesFromText(text: string): InferredParties {
  const parties: InferredParties = {};
  const haystack = text.replace(/\s+/g, ' ');

  const both = haystack.match(BOTH_PARTIES_PATTERN);
  if (both) {
    const first = cleanPartyCandidate(both[1] ?? '');
    const second = cleanPartyCandidate(both[2] ?? '');
    if (first) parties.parte_reveladora = first;
    if (second) parties.parte_receptora = second;
  }

  for (const { key, pattern } of PARTY_LABEL_PATTERNS) {
    if (parties[key]) continue;
    const match = haystack.match(pattern);
    if (!match?.[1]) continue;
    const candidate = cleanPartyCandidate(match[1]);
    if (candidate) parties[key] = candidate;
  }

  return parties;
}

function toMetadataField(label: string, value: string): ExtractedMetadataField {
  return {
    label,
    value,
    normalizedValue: value,
    confidence: 0.55,
    source: 'document_text',
    evidence: { snippet: value.slice(0, 120) },
  };
}

function sanitizeExistingPartyField(
  field: ExtractedMetadataField | undefined,
): ExtractedMetadataField | undefined {
  if (!field) return undefined;
  const raw = field.normalizedValue ?? field.value;
  if (typeof raw !== 'string') return undefined;
  const cleaned = sanitizePartyMetadataValue(raw);
  if (!cleaned) return undefined;
  return {
    ...field,
    value: cleaned,
    normalizedValue: cleaned,
  };
}

/** Completa parte_reveladora / parte_receptora a partir dos trechos do PDF quando a IA não preencheu. */
export function enrichMetadataWithPartyHeuristics(input: {
  chunks: RetrievedChunk[];
  selectedClass: DocumentClassRule;
  metadata: Record<string, ExtractedMetadataField>;
}): Record<string, ExtractedMetadataField> {
  if (!isConfidentialityClassRule(input.selectedClass)) {
    return input.metadata;
  }

  const merged = { ...input.metadata };

  const reveladora = sanitizeExistingPartyField(merged.parte_reveladora);
  const receptora = sanitizeExistingPartyField(merged.parte_receptora);
  if (reveladora) merged.parte_reveladora = reveladora;
  else delete merged.parte_reveladora;
  if (receptora) merged.parte_receptora = receptora;
  else delete merged.parte_receptora;

  const hasReveladora = Boolean(merged.parte_reveladora?.value);
  const hasReceptora = Boolean(merged.parte_receptora?.value);
  if (hasReveladora && hasReceptora) return merged;

  const text = input.chunks.map((chunk) => chunk.text).join('\n\n');
  const inferred = inferPartiesFromText(text);

  if (!hasReveladora && inferred.parte_reveladora) {
    merged.parte_reveladora = toMetadataField('Parte reveladora', inferred.parte_reveladora);
  }

  if (!hasReceptora && inferred.parte_receptora) {
    merged.parte_receptora = toMetadataField('Parte receptora', inferred.parte_receptora);
  }

  return merged;
}

export function collectMetadataText(metadata: Record<string, ExtractedMetadataField>): string {
  return Object.values(metadata)
    .map((field) => {
      const evidence =
        typeof field.evidence === 'object' && field.evidence && 'snippet' in field.evidence
          ? String(field.evidence.snippet)
          : '';
      const value = field.normalizedValue ?? field.value;
      return [value, evidence].filter(Boolean).join(' ');
    })
    .join('\n');
}

export function normalizePartyValue(value: string): string {
  const normalized = normalizeStringFieldValue(value, {
    key: 'parte',
    label: 'Parte',
    type: 'string',
    required: false,
  });
  return typeof normalized === 'string' ? normalized : value.trim();
}

export { isValidPartyName };
