import type {
  ClassificationResult,
  DocumentClassRule,
  MetadataExtractionResult,
  RetrievedChunk,
} from '../types/documentAi.types.js';
import { AI_ERROR_MESSAGES } from '../constants.js';
import { safeParseJsonFromModel } from '../utils/jsonParsing.js';
import { validateMetadataResult } from '../utils/validation.js';
import { buildCompactExtractorPrompt } from '../utils/extractorPrompt.js';
import { completeJsonPrompt, type GroqPromptContext } from './groqClient.js';
import { logger } from '../../utils/logger.js';

export async function extractMetadataWithRule(input: {
  chunks: RetrievedChunk[];
  selectedClass: DocumentClassRule;
  classification: ClassificationResult;
  context?: GroqPromptContext;
}): Promise<MetadataExtractionResult> {
  const requiredFieldKeys = input.selectedClass.fields.filter((f) => f.required).map((f) => f.key);

  try {
    const { prompt } = buildCompactExtractorPrompt(input.chunks, input.selectedClass);
    const raw = await completeJsonPrompt(prompt, {
        context: {
          ...input.context,
          operation: 'metadata_extraction',
        },
      },
    );
    const parsed = safeParseJsonFromModel<unknown>(raw);

    if (!parsed) {
      return {
        documentType: input.selectedClass.name,
        version: 'v1.0',
        metadata: {},
        missingFields: requiredFieldKeys,
        requiresReview: true,
        reviewReasons: [AI_ERROR_MESSAGES.invalidAiResponse],
      };
    }

    const validated = validateMetadataResult(parsed, input.selectedClass);

    return {
      ...validated,
      documentType: validated.documentType ?? input.selectedClass.name,
    };
  } catch (error) {
    // O `catch` vazio anterior descartava a causa: o usuário via "a análise automática falhou" e
    // não sobrava nada no servidor para diagnosticar. Falha de extração é o caminho mais comum de
    // regressão de prompt e de modelo — precisa deixar rastro.
    logger.error('metadata extraction failed', {
      requestId: input.context?.requestId,
      jobId: input.context?.jobId,
      companyId: input.context?.companyId,
      className: input.selectedClass.name,
      classId: input.selectedClass.id,
      fieldCount: input.selectedClass.fields.length,
      chunkCount: input.chunks.length,
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    return {
      documentType: input.selectedClass.name,
      version: 'v1.0',
      metadata: {},
      missingFields: requiredFieldKeys,
      requiresReview: true,
      reviewReasons: [AI_ERROR_MESSAGES.analysisFailed],
    };
  }
}
