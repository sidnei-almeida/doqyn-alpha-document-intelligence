/**
 * O extrator focado — a segunda leitura.
 *
 * Recebe só os campos que o Avaliador mandou reprocurar e só os trechos que a re-seleção associou
 * a cada um. Devolve metadados parciais: o que ele não encontrar continua sendo problema do valor
 * anterior, e a mesclagem é decidida fora daqui.
 *
 * Ele não sabe que existe um laço. Isso é de propósito: se um dia o refino ganhar uma terceira
 * estratégia, é o laço que muda, não este agente.
 */
import type {
  DocumentClassRule,
  DocumentNamingRoles,
  ExtractedMetadataField,
} from '../types/documentAi.types.js';
import { safeParseJsonFromModel } from '../utils/jsonParsing.js';
import {
  buildFocusedExtractorPrompt,
  type FocusedNamingTarget,
  type FocusedTarget,
} from '../utils/focusedExtractorPrompt.js';
import { applyFieldNormalization, parseEvidence, parseNamingRoles } from '../utils/validation.js';
import {
  completeJsonPromptWithUsage,
  EMPTY_TOKEN_USAGE,
  type GroqPromptContext,
  type TokenUsage,
} from './groqClient.js';
import { isGroqSaturationError } from '../utils/groqSaturation.js';
import { logger } from '../../utils/logger.js';

export type FocusedExtractionResult = {
  /** Só os campos que voltaram preenchidos. Campo que o modelo devolveu null não entra. */
  metadata: Record<string, ExtractedMetadataField>;
  naming?: DocumentNamingRoles;
  usage: TokenUsage;
};

function parseFocusedMetadata(input: {
  raw: unknown;
  targets: FocusedTarget[];
}): Record<string, ExtractedMetadataField> {
  if (!input.raw || typeof input.raw !== 'object') return {};
  const metadataRaw = (input.raw as { metadata?: unknown }).metadata;
  if (!metadataRaw || typeof metadataRaw !== 'object') return {};

  const byKey = new Map(input.targets.map((target) => [target.field.key, target.field]));
  const result: Record<string, ExtractedMetadataField> = {};

  for (const [key, entry] of Object.entries(metadataRaw as Record<string, unknown>)) {
    const field = byKey.get(key);
    // Campo fora da lista pedida é ruído: o passe focado não tem autoridade para preencher o que
    // ninguém mandou reprocurar, e aceitá-lo abriria caminho para sobrescrever campo que passou.
    if (!field || !entry || typeof entry !== 'object') continue;

    const data = entry as Record<string, unknown>;
    const rawValue =
      typeof data.value === 'string' || typeof data.value === 'number' ? data.value : null;
    if (rawValue === null || String(rawValue).trim() === '') continue;

    const modelNormalized =
      typeof data.normalizedValue === 'string' || typeof data.normalizedValue === 'number'
        ? data.normalizedValue
        : undefined;

    const normalized = applyFieldNormalization(field, rawValue, modelNormalized);
    const confidence =
      typeof data.confidence === 'number' && Number.isFinite(data.confidence)
        ? Math.min(1, Math.max(0, data.confidence))
        : 0.7;

    result[key] = {
      label: field.label,
      value: normalized.value,
      normalizedValue: normalized.normalizedValue,
      confidence,
      source: 'document_text',
      evidence: parseEvidence(data.evidence),
      ...(normalized.currency ? { currency: normalized.currency } : {}),
    };
  }

  return result;
}

export async function extractFocusedFields(input: {
  selectedClass: DocumentClassRule;
  targets: FocusedTarget[];
  naming?: FocusedNamingTarget;
  context?: GroqPromptContext;
  model?: string;
}): Promise<FocusedExtractionResult> {
  if (input.targets.length === 0 && !input.naming?.keys.length) {
    return { metadata: {}, usage: EMPTY_TOKEN_USAGE };
  }

  const prompt = buildFocusedExtractorPrompt({
    selectedClass: input.selectedClass,
    targets: input.targets,
    naming: input.naming,
  });

  try {
    const answer = await completeJsonPromptWithUsage(prompt, {
      context: { ...input.context, operation: 'focused_extraction' },
      model: input.model,
    });

    const parsed = safeParseJsonFromModel<unknown>(answer.content);
    if (!parsed) {
      logger.warn('extração focada devolveu resposta inutilizável', {
        requestId: input.context?.requestId,
        jobId: input.context?.jobId,
        className: input.selectedClass.name,
        targetKeys: input.targets.map((target) => target.field.key),
        responseChars: answer.content.length,
      });
      return { metadata: {}, usage: answer.usage };
    }

    return {
      metadata: parseFocusedMetadata({ raw: parsed, targets: input.targets }),
      naming: input.naming?.keys.length
        ? parseNamingRoles((parsed as { naming?: unknown }).naming, input.selectedClass.name)
        : undefined,
      usage: answer.usage,
    };
  } catch (error) {
    // Mesmo contrato do extrator principal: saturação sobe e o worker devolve o job à fila; o
    // resto vira passe sem resultado, e o laço segue com o que já tinha.
    if (isGroqSaturationError(error)) {
      throw error;
    }

    logger.error('extração focada falhou', {
      requestId: input.context?.requestId,
      jobId: input.context?.jobId,
      companyId: input.context?.companyId,
      className: input.selectedClass.name,
      targetKeys: input.targets.map((target) => target.field.key),
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    return { metadata: {}, usage: EMPTY_TOKEN_USAGE };
  }
}

export { parseFocusedMetadata };
