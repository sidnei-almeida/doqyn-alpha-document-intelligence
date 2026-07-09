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
  } catch {
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
