import type {
  DocumentChunk,
  DocumentClassRule,
  DocumentRuleField,
  ExtractedMetadataField,
  MetadataExtractionResult,
} from '../types/documentAi.types.js';
import { completeJsonPrompt, type GroqPromptContext } from '../services/groqClient.js';
import { safeParseJsonFromModel } from '../utils/jsonParsing.js';
import { normalizeStringFieldValue } from './documentValidators.js';
import { parsePortugueseLongDate } from '../utils/dateMetadataHeuristics.js';
import { parseMetadataDate } from '../../services/confirm/projectSearchMeta.js';
import { MIN_FIELD_CONFIDENCE } from '../constants.js';
import { pipelineInfo, pipelineWarn } from '../utils/pipelineDebug.js';

/**
 * Texto vindo do Vision achata o layout: o rótulo ("Vencimento") e o valor
 * podem cair longe um do outro — ou em chunks distintos — e o retrieval por
 * keyword deixa de selecionar o trecho que tem o valor. Esta passagem varre o
 * documento inteiro (sem o corte de MAX_CHUNKS_FOR_EXTRACTION) atrás dos
 * campos obrigatórios que sobraram vazios.
 */
const MAX_RECOVERY_CHUNKS = 24;
const MAX_RECOVERY_FIELDS = 8;
/**
 * Orçamento do prompt inteiro. Chunk NUNCA é cortado no meio: o fecho do
 * documento (onde mora a data de assinatura) vive na cauda do último chunk —
 * truncar por chunk apagava justamente o que esta passagem veio buscar.
 */
const MAX_RECOVERY_TOTAL_CHARS = 24000;

function fieldHasValue(
  field: Pick<ExtractedMetadataField, 'value' | 'normalizedValue'> | undefined,
): boolean {
  if (!field) return false;
  const raw = field.normalizedValue ?? field.value;
  if (raw == null) return false;
  if (typeof raw === 'string') return raw.trim().length > 0;
  return true;
}

/** Inclui chunks inteiros até estourar o orçamento — sem cortar cauda. */
function formatChunks(chunks: DocumentChunk[]): string {
  const parts: string[] = [];
  let budget = MAX_RECOVERY_TOTAL_CHARS;

  for (const chunk of chunks.slice(0, MAX_RECOVERY_CHUNKS)) {
    if (chunk.text.length > budget) break;
    parts.push(`[página ${chunk.pageNumber ?? '?'}, trecho ${chunk.chunkIndex}]\n${chunk.text}`);
    budget -= chunk.text.length;
  }

  return parts.join('\n\n---\n\n');
}

/** Casefold + sem acento + espaços colapsados, para comparar com texto de OCR. */
function normalizeForMatch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * O trecho citado tem que existir no documento. Evidência inventada é o sinal
 * mais direto de valor alucinado — melhor deixar o campo vazio.
 */
function isEvidenceGrounded(evidence: string, documentText: string): boolean {
  const needle = normalizeForMatch(evidence);
  // Citação curta demais não prova nada (ex.: "2026").
  if (needle.length < 8) return false;
  return normalizeForMatch(documentText).includes(needle);
}

/** Toda data reconhecível dentro de um trecho, em yyyy-mm-dd. */
function datesInText(text: string): string[] {
  const found: string[] = [];

  for (const match of text.matchAll(
    /\d{1,2}\s+de\s+\w+\s+de\s+\d{4}|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4}\b/gi,
  )) {
    const raw = match[0];
    const parsed = parsePortugueseLongDate(raw) ?? parseMetadataDate(raw);
    if (parsed) found.push(parsed.toISOString().slice(0, 10));
  }

  return found;
}

/**
 * Evidência real não basta: o modelo pode citar um trecho verdadeiro e colar um
 * valor inventado nele (visto em teste: citou "Caxias do Sul/RS." e devolveu
 * data "2023-12-01"). O valor precisa estar dentro do próprio trecho citado.
 */
function evidenceSupportsValue(
  normalizedValue: string | number,
  evidence: string,
  field: DocumentRuleField,
): boolean {
  if (field.type === 'date') {
    return datesInText(evidence).includes(String(normalizedValue));
  }
  return normalizeForMatch(evidence).includes(normalizeForMatch(String(normalizedValue)));
}

/**
 * `normalizeDate` só aceita ISO/dd-mm-aaaa. O modelo às vezes devolve a data
 * como está no documento ("09 de junho de 2026"), então cai no parser tolerante
 * antes de desistir do valor.
 */
function normalizeFieldValue(
  rawValue: string | number,
  field: DocumentRuleField,
): string | number | null {
  const normalized = normalizeStringFieldValue(rawValue, field);
  if (normalized !== null && normalized !== '') return normalized;
  if (field.type !== 'date') return normalized;

  const parsed = parseMetadataDate(rawValue);
  return parsed ? parsed.toISOString().slice(0, 10) : null;
}

function describeField(field: DocumentRuleField): string {
  const parts = [`- ${field.key} (${field.label}, tipo: ${field.type})`];
  if (field.description) parts.push(`  descrição: ${field.description}`);
  if (field.aliases?.length) parts.push(`  também aparece como: ${field.aliases.join(', ')}`);
  if (field.examples?.length) parts.push(`  exemplos: ${field.examples.slice(0, 3).join(' | ')}`);
  return parts.join('\n');
}

type RecoveredField = {
  value?: string | number | null;
  evidence?: string | null;
};

type RecoverResponse = Record<string, RecoveredField | null | undefined>;

/**
 * Segunda passagem Groq para campos obrigatórios ausentes — só no caminho OCR.
 * Não sobrescreve campo já preenchido.
 */
export async function recoverMissingRequiredFieldsFromOcr(input: {
  chunks: DocumentChunk[];
  metadata: Record<string, ExtractedMetadataField>;
  selectedClass: DocumentClassRule;
  ocrFallbackUsed: boolean;
  context?: GroqPromptContext;
}): Promise<Record<string, ExtractedMetadataField>> {
  const { metadata, selectedClass, context } = input;

  if (!input.ocrFallbackUsed) return metadata;
  if (!input.chunks.length) return metadata;

  const missingRequired = selectedClass.fields
    .filter((field) => field.required && !fieldHasValue(metadata[field.key]))
    .slice(0, MAX_RECOVERY_FIELDS);

  if (missingRequired.length === 0) return metadata;

  pipelineInfo('ocrRecovery', 'campos obrigatórios ausentes após OCR — segunda passagem', {
    classId: selectedClass.id,
    className: selectedClass.name,
    missingFields: missingRequired.map((f) => f.key),
    chunksAvailable: input.chunks.length,
    chunksSent: Math.min(input.chunks.length, MAX_RECOVERY_CHUNKS),
  });

  const prompt = `Você é um extrator de metadados do DOQYN trabalhando sobre texto vindo de OCR.

O texto veio de OCR: o layout foi achatado, então rótulos e valores podem estar
separados, fora de ordem ou em linhas distantes. Um campo pode estar presente
mesmo sem rótulo explícito ao lado — procure pelo sentido do documento.

Campos a extrair:
${missingRequired.map(describeField).join('\n')}

Onde essas informações costumam aparecer em documentos brasileiros:
- Data de assinatura: no fecho, perto de "ASSINATURAS", acima dos nomes das partes,
  no padrão "Cidade/UF, DD de mês de AAAA" — nesse padrão a data É a data de
  assinatura, mesmo sem a palavra "assinado". Também após "assinado em",
  "firmado em", "celebrado em", "aos X dias do mês de".
- Vencimento/validade: em boletos e faturas, em caixa própria, às vezes com o
  rótulo distante do valor por causa do OCR.

Regras:
1. Procure no documento inteiro, do início ao fim. O fecho costuma ter a data.
2. NUNCA invente. null é uma resposta correta e esperada quando a informação
   não está no documento. Campo vazio não é um problema; dado errado é.
3. Não deduza, não estime, não calcule um valor que não esteja escrito.
4. Nunca use a data de hoje, data de upload, nem valores de exemplo deste prompt.
5. Datas: converta para yyyy-mm-dd (ex.: "09 de junho de 2026" -> "2026-06-09").
6. Valores monetários: apenas o número.
7. evidence = trecho copiado LITERALMENTE do texto acima, sem reescrever. Se você
   não conseguir copiar um trecho literal que contenha o valor, responda null.
8. Responda APENAS JSON.

Trechos:
${formatChunks(input.chunks)}

Formato (uma chave por campo pedido):
{${missingRequired.map((f) => `"${f.key}":{"value":<valor>|null,"evidence":"trecho literal"|null}`).join(',')}}`;

  try {
    const raw = await completeJsonPrompt(prompt, {
      context: {
        ...context,
        operation: 'ocr_required_fields_recovery',
      },
    });

    const parsed = safeParseJsonFromModel<RecoverResponse>(raw);
    if (!parsed) {
      pipelineWarn('ocrRecovery', 'resposta do modelo não parseável — mantendo metadados', {
        missingFields: missingRequired.map((f) => f.key),
      });
      return metadata;
    }

    const out = { ...metadata };
    const recoveredKeys: string[] = [];
    const rejectedKeys: Array<{ key: string; reason: string }> = [];
    const documentText = input.chunks.map((chunk) => chunk.text).join('\n');

    for (const field of missingRequired) {
      const entry = parsed[field.key];
      if (!entry || typeof entry !== 'object') continue;

      const rawValue =
        typeof entry.value === 'string' || typeof entry.value === 'number' ? entry.value : null;
      if (rawValue === null || rawValue === '') continue;

      const normalizedValue = normalizeFieldValue(rawValue, field);
      if (normalizedValue === null || normalizedValue === '') continue;

      // Só preenche se ainda estiver vazio — heurísticas anteriores têm prioridade.
      if (fieldHasValue(out[field.key])) continue;

      const evidence = typeof entry.evidence === 'string' ? entry.evidence.trim() : '';

      // Campo vazio é aceitável; dado inventado não é. Sem evidência citada, ou
      // com evidência que não existe no documento, o valor é descartado.
      if (!evidence) {
        rejectedKeys.push({ key: field.key, reason: 'sem evidência citada' });
        continue;
      }
      if (!isEvidenceGrounded(evidence, documentText)) {
        rejectedKeys.push({ key: field.key, reason: 'evidência não encontrada no documento' });
        continue;
      }
      if (!evidenceSupportsValue(normalizedValue, evidence, field)) {
        rejectedKeys.push({
          key: field.key,
          reason: 'trecho citado não contém o valor devolvido',
        });
        continue;
      }

      out[field.key] = {
        label: field.label,
        value: rawValue,
        normalizedValue,
        confidence: 0.72,
        source: 'ai',
        evidence: { snippet: evidence.slice(0, 160) },
      };
      recoveredKeys.push(field.key);
    }

    if (rejectedKeys.length > 0) {
      pipelineWarn('ocrRecovery', 'valores descartados por falta de ancoragem no texto', {
        rejected: rejectedKeys,
      });
    }

    pipelineInfo('ocrRecovery', 'segunda passagem concluída', {
      requestedFields: missingRequired.map((f) => f.key),
      recoveredFields: recoveredKeys,
      recoveredCount: recoveredKeys.length,
    });

    return out;
  } catch (error) {
    pipelineWarn('ocrRecovery', 'segunda passagem falhou — mantendo metadados originais', {
      missingFields: missingRequired.map((f) => f.key),
      error: error instanceof Error ? error.message : String(error),
    });
    return metadata;
  }
}

/**
 * `missingFields`/`requiresReview` vêm da validação, que roda antes das
 * heurísticas e das passagens de recuperação. Sem isto, um campo obrigatório
 * preenchido depois continua marcado como ausente e o documento segue em
 * revisão à toa.
 */
export function reconcileRequiredFieldsAfterEnrichment(input: {
  extraction: MetadataExtractionResult;
  selectedClass: DocumentClassRule;
}): MetadataExtractionResult {
  const { extraction, selectedClass } = input;

  const requiredKeys = new Set(
    selectedClass.fields.filter((field) => field.required).map((field) => field.key),
  );

  const stillMissing = extraction.missingFields.filter((key) => {
    if (!requiredKeys.has(key)) return true;
    return !fieldHasValue(extraction.metadata[key]);
  });

  const resolvedKeys = extraction.missingFields.filter((key) => !stillMissing.includes(key));
  if (resolvedKeys.length === 0) return extraction;

  const stillMissingRequired = stillMissing.filter((key) => requiredKeys.has(key));

  // Campos recuperados com confiança aceitável: os motivos por campo criados
  // quando eles estavam vazios não valem mais.
  const settled = resolvedKeys.filter((key) => {
    const field = extraction.metadata[key];
    return Boolean(field) && field.confidence >= MIN_FIELD_CONFIDENCE;
  });
  const settledLabels = settled
    .map((key) => selectedClass.fields.find((f) => f.key === key)?.label)
    .filter((label): label is string => Boolean(label));

  const nothingMissing = stillMissingRequired.length === 0;

  const reviewReasons = extraction.reviewReasons.filter((reason) => {
    // "está faltando campo obrigatório" — falso quando nada falta.
    if (nothingMissing && /ausente|missing/i.test(reason)) return false;
    // "confiança baixa"/"sem evidência" de campo que agora está preenchido e confiável.
    if (settledLabels.some((label) => reason.includes(`"${label}"`))) return false;
    // O modelo às vezes devolve só a chave do campo como motivo.
    if (settled.includes(reason.trim())) return false;
    return true;
  });

  const requiresReview =
    stillMissingRequired.length > 0 || reviewReasons.some((reason) => reason.includes('obrigatório'));

  pipelineInfo('ocrRecovery', 'reconciliando campos obrigatórios após enriquecimento', {
    resolvedFields: resolvedKeys,
    stillMissingFields: stillMissingRequired,
    requiresReviewBefore: extraction.requiresReview,
    requiresReviewAfter: requiresReview,
  });

  return {
    ...extraction,
    missingFields: stillMissing,
    requiresReview,
    reviewReasons,
  };
}
