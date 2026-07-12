import type { MongoVersionMetadataField } from '../../db/types.js';

/** Origem do campo na extração (pipeline IA / heurística). */
export type ExtractedMetadataSource = 'document_text' | 'no_ai' | 'ai' | 'manual' | string;

/**
 * Mapeia source da análise → source persistido no MongoDB.
 * `no_ai` = heurística sem LLM → document_text (não era IA).
 */
export function mapExtractedFieldSource(
  source: ExtractedMetadataSource | undefined,
): MongoVersionMetadataField['source'] {
  if (source === 'manual') return 'manual';
  if (source === 'document_text' || source === 'no_ai') return 'document_text';
  return 'ai';
}
