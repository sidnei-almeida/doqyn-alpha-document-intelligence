import type {
  DocumentChunk,
  DocumentClassRule,
  ExtractedMetadataField,
} from '../types/documentAi.types.js';
import { completeJsonPrompt, type GroqPromptContext } from '../services/groqClient.js';
import { safeParseJsonFromModel } from '../utils/jsonParsing.js';
import { parseMetadataDate } from '../../services/confirm/projectSearchMeta.js';
import { MAX_CHARS_PER_EXTRACTOR_CHUNK } from '../constants.js';
import { isConfidentialityClassRule } from '../utils/documentClassHeuristics.js';

function fieldHasValue(
  field: Pick<ExtractedMetadataField, 'value' | 'normalizedValue'> | undefined,
): boolean {
  if (!field) return false;
  const raw = field.normalizedValue ?? field.value;
  if (raw == null) return false;
  if (typeof raw === 'string') return raw.trim().length > 0;
  return true;
}

function hasPrazo(metadata: Record<string, ExtractedMetadataField>): boolean {
  for (const key of ['prazo_vigencia', 'prazo', 'vigencia_prazo', 'periodo_vigencia', 'duracao']) {
    if (fieldHasValue(metadata[key])) return true;
  }
  return false;
}

function formatChunks(chunks: DocumentChunk[]): string {
  return chunks
    .slice(0, 10)
    .map((chunk) => {
      const text =
        chunk.text.length > MAX_CHARS_PER_EXTRACTOR_CHUNK
          ? `${chunk.text.slice(0, MAX_CHARS_PER_EXTRACTOR_CHUNK)}…`
          : chunk.text;
      const page = chunk.pageNumber ?? '?';
      return `[página ${page}, trecho ${chunk.chunkIndex}]\n${text}`;
    })
    .join('\n\n---\n\n');
}

type RecoverResponse = {
  data_assinatura?: string | null;
  data_validade?: string | null;
  evidence?: string | null;
};

/**
 * Segunda passagem Groq: só quando há prazo/vigência e falta data âncora.
 */
export async function recoverMissingValidityAnchor(input: {
  chunks: DocumentChunk[];
  metadata: Record<string, ExtractedMetadataField>;
  selectedClass: DocumentClassRule;
  context?: GroqPromptContext;
}): Promise<Record<string, ExtractedMetadataField>> {
  const { metadata, selectedClass, context } = input;
  if (!isConfidentialityClassRule(selectedClass) && !hasPrazo(metadata)) {
    return metadata;
  }
  if (!hasPrazo(metadata)) return metadata;
  if (fieldHasValue(metadata.data_assinatura) || fieldHasValue(metadata.data_validade)) {
    return metadata;
  }
  if (!input.chunks.length) return metadata;

  const prazoValue = String(
    metadata.prazo_vigencia?.normalizedValue ??
      metadata.prazo_vigencia?.value ??
      metadata.prazo?.value ??
      '',
  ).trim();

  const prompt = `Você é um extrator de DATAS em contratos NDA/confidencialidade (DOQYN).

Contexto: já extraindo prazo_vigencia="${prazoValue || 'presente'}", mas falta a data âncora.

Tarefa crítica:
1. Encontre a data de assinatura/celebração/firma do acordo nos trechos (data_assinatura).
2. Se conseguir âncora + prazo, calcule data_validade (yyyy-mm-dd).
3. NÃO invente. Sem data nos trechos → null.
4. Nunca use data de hoje, upload ou nome de arquivo inventado.
5. Responda APENAS JSON.

Padrões a procurar:
- "assinado em", "firmado em", "celebrado em", "datado de"
- "aos X dias de [mês] de [ano]"
- dd/mm/aaaa, aaaa-mm-dd, "10 de março de 2024"
- início de vigência "a partir de [data]"

Trechos:
${formatChunks(input.chunks)}

Formato:
{"data_assinatura":"yyyy-mm-dd"|null,"data_validade":"yyyy-mm-dd"|null,"evidence":"trecho literal ou null"}`;

  try {
    const raw = await completeJsonPrompt(prompt, {
      context: {
        ...context,
        operation: 'validity_anchor_recovery',
      },
    });
    const parsed = safeParseJsonFromModel<RecoverResponse>(raw);
    if (!parsed) return metadata;

    const out = { ...metadata };
    const assinatura = parsed.data_assinatura
      ? parseMetadataDate(parsed.data_assinatura)
      : null;
    const validade = parsed.data_validade ? parseMetadataDate(parsed.data_validade) : null;
    const evidence = parsed.evidence?.trim() || 'Recuperado em passagem de datas (Groq).';

    if (assinatura && !fieldHasValue(out.data_assinatura)) {
      const iso = assinatura.toISOString().slice(0, 10);
      const field: ExtractedMetadataField = {
        label: 'Data de assinatura',
        value: iso,
        normalizedValue: iso,
        confidence: 0.8,
        source: 'ai',
        evidence: { snippet: evidence.slice(0, 160) },
      };
      out.data_assinatura = field;
    }

    if (validade && !fieldHasValue(out.data_validade)) {
      const iso = validade.toISOString().slice(0, 10);
      out.data_validade = {
        label: 'Validade',
        value: iso,
        normalizedValue: iso,
        confidence: 0.78,
        source: 'ai',
        evidence: { snippet: evidence.slice(0, 160) },
      };
    }

    return out;
  } catch {
    return metadata;
  }
}
