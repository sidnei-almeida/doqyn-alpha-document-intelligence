import type {
  ClassificationResult,
  DocumentClassRule,
  MetadataExtractionResult,
  RetrievedChunk,
} from '../types/documentAi.types.js';
import { AI_ERROR_MESSAGES } from '../constants.js';
import { safeParseJsonFromModel } from '../utils/jsonParsing.js';
import { validateMetadataResult } from '../utils/validation.js';
import {
  buildUpdateExtractorPrompt,
  type PreviousVersionContext,
} from '../utils/updateExtractorPrompt.js';
import {
  compareDocumentVersions,
  buildMetadataSummary,
  type VersionComparisonResult,
} from '../utils/versionComparison.js';
import { completeJsonPrompt, type GroqPromptContext } from './groqClient.js';
import { isGroqSaturationError } from '../utils/groqSaturation.js';

export type VersionUpdateExtractionResult = MetadataExtractionResult & {
  versionComparison: VersionComparisonResult;
  seemsSameDocument: boolean;
  sameDocumentConfidence: number;
  sameDocumentEvidence: string[];
  mainChanges: string[];
  changedFields: string[];
  riskWarnings: string[];
};

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function mergeComparison(
  modelComparison: Partial<VersionComparisonResult>,
  heuristic: VersionComparisonResult,
): VersionComparisonResult {
  return {
    changedFields: [...new Set([...heuristic.changedFields, ...parseStringArray(modelComparison.changedFields)])],
    addedFields: heuristic.addedFields,
    removedFields: heuristic.removedFields,
    riskWarnings: [...new Set([...heuristic.riskWarnings, ...parseStringArray(modelComparison.riskWarnings)])],
    sameDocumentConfidence:
      typeof modelComparison.sameDocumentConfidence === 'number'
        ? Math.min(1, Math.max(0, modelComparison.sameDocumentConfidence))
        : heuristic.sameDocumentConfidence,
    mainChanges: [...new Set([...parseStringArray(modelComparison.mainChanges), ...heuristic.mainChanges])],
  };
}

export async function extractMetadataForVersionUpdate(input: {
  chunks: RetrievedChunk[];
  selectedClass: DocumentClassRule;
  classification: ClassificationResult;
  previousVersion: PreviousVersionContext;
  previousMetadata: Record<string, import('../../db/types.js').MongoVersionMetadataField>;
  context?: GroqPromptContext;
}): Promise<VersionUpdateExtractionResult> {
  const requiredFieldKeys = input.selectedClass.fields.filter((f) => f.required).map((f) => f.key);

  try {
    const { prompt } = buildUpdateExtractorPrompt({
      chunks: input.chunks,
      selectedClass: input.selectedClass,
      previousVersion: input.previousVersion,
    });

    const raw = await completeJsonPrompt(prompt, {
      context: {
        ...input.context,
        operation: 'metadata_version_update',
      },
    });

    const parsed = safeParseJsonFromModel<Record<string, unknown>>(raw);
    if (!parsed) {
      return buildFallback(requiredFieldKeys, input.selectedClass.name, input.previousVersion.expectedNextVersionLabel);
    }

    const validated = validateMetadataResult(parsed, input.selectedClass);
    const heuristicComparison = compareDocumentVersions({
      oldMetadata: input.previousMetadata,
      newMetadata: Object.fromEntries(
        Object.entries(validated.metadata).map(([key, field]) => [
          key,
          {
            label: field.label,
            value: field.value,
            normalizedValue: field.normalizedValue ?? field.value,
            confidence: field.confidence,
            source: 'ai' as const,
            evidence: field.evidence,
          },
        ]),
      ),
      oldCategory: input.previousVersion.categoryName,
      newCategory: input.selectedClass.name,
      oldSummary: input.previousVersion.metadataSummary,
      newSummary: buildMetadataSummary(
        Object.fromEntries(
          Object.entries(validated.metadata).map(([key, field]) => [
            key,
            {
              label: field.label,
              value: field.value,
              normalizedValue: field.normalizedValue ?? field.value,
              confidence: field.confidence,
              source: 'ai' as const,
            },
          ]),
        ),
        input.selectedClass.name,
      ),
    });

    const seemsSameDocument =
      typeof parsed.seemsSameDocument === 'boolean'
        ? parsed.seemsSameDocument
        : heuristicComparison.sameDocumentConfidence >= 0.55;

    const sameDocumentConfidence =
      typeof parsed.sameDocumentConfidence === 'number'
        ? Math.min(1, Math.max(0, parsed.sameDocumentConfidence))
        : heuristicComparison.sameDocumentConfidence;

    const versionComparison = mergeComparison(
      {
        changedFields: parseStringArray(parsed.changedFields),
        riskWarnings: parseStringArray(parsed.riskWarnings),
        mainChanges: parseStringArray(parsed.mainChanges),
        sameDocumentConfidence,
      },
      heuristicComparison,
    );

    const modelMainChanges = parseStringArray(parsed.mainChanges);
    const mainChanges =
      modelMainChanges.length > 0 ? modelMainChanges : versionComparison.mainChanges;
    const riskWarnings = [
      ...new Set([
        ...parseStringArray(parsed.riskWarnings),
        ...versionComparison.riskWarnings,
        ...(!seemsSameDocument
          ? ['O modelo indicou que o arquivo pode ser um documento diferente — revisão manual obrigatória.']
          : []),
      ]),
    ];

    const requiresReview =
      validated.requiresReview ||
      !seemsSameDocument ||
      sameDocumentConfidence < 0.55 ||
      riskWarnings.length > 0;

    const reviewReasons = [
      ...new Set([
        ...validated.reviewReasons,
        ...(!seemsSameDocument ? ['Possível documento diferente da versão anterior.'] : []),
        ...(sameDocumentConfidence < 0.55
          ? ['Baixa confiança de continuidade entre versões.']
          : []),
      ]),
    ];

    return {
      ...validated,
      documentType: validated.documentType ?? input.selectedClass.name,
      version: input.previousVersion.expectedNextVersionLabel,
      requiresReview,
      reviewReasons,
      versionComparison,
      seemsSameDocument,
      sameDocumentConfidence,
      sameDocumentEvidence: parseStringArray(parsed.sameDocumentEvidence),
      mainChanges,
      changedFields: versionComparison.changedFields,
      riskWarnings,
    };
  } catch (error) {
    // Saturação da vazão sobe para o worker devolver o job à fila; o resto continua virando
    // revisão manual da nova versão.
    if (isGroqSaturationError(error)) {
      throw error;
    }

    return buildFallback(requiredFieldKeys, input.selectedClass.name, input.previousVersion.expectedNextVersionLabel);
  }
}

function buildFallback(
  requiredFieldKeys: string[],
  className: string,
  versionLabel: string,
): VersionUpdateExtractionResult {
  const emptyComparison: VersionComparisonResult = {
    changedFields: [],
    addedFields: [],
    removedFields: [],
    riskWarnings: [],
    sameDocumentConfidence: 0,
    mainChanges: [],
  };

  return {
    documentType: className,
    version: versionLabel,
    metadata: {},
    missingFields: requiredFieldKeys,
    requiresReview: true,
    reviewReasons: [AI_ERROR_MESSAGES.analysisFailed],
    versionComparison: emptyComparison,
    seemsSameDocument: false,
    sameDocumentConfidence: 0,
    sameDocumentEvidence: [],
    mainChanges: [],
    changedFields: [],
    riskWarnings: ['Falha na análise da nova versão.'],
  };
}
