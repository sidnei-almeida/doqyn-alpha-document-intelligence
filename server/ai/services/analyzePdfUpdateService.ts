import { createHash, randomUUID } from 'node:crypto';
import {
  AI_ERROR_MESSAGES,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  MIN_TEXT_CHARS,
} from '../constants.js';
import {
  loadActiveDocumentClassRules,
  getDocumentClassRuleById,
  isDocumentRulesNotSeededError,
} from '../../services/documentRulesService.js';
import type {
  AnalyzePdfUpdateResponse,
  ProcessingLogItem,
} from '../types/documentAi.types.js';
import { AiAnalysisError } from '../utils/errors.js';
import { assertAiProviderConfigured } from '../utils/aiProvider.js';
import { resolveAnalysisProvider } from '../providers/resolveAnalysisProvider.js';
import { createDocumentChunks } from './documentChunker.js';
import { extractMetadataForVersionUpdate } from './metadataUpdateExtractorAgent.js';
import { generateRecommendedFileName } from './documentNaming.js';
import { augmentConfidentialityClassForExtraction } from '../utils/documentClassHeuristics.js';
import { enrichMetadataWithPartyHeuristics } from '../utils/partyMetadataHeuristics.js';
import {
  buildRetrievalStats,
  selectChunksForClassification,
  selectChunksForExtraction,
} from '../../services/retrievalProvider.js';
import { logger } from '../../utils/logger.js';
import { extractTextFromPdf } from './pdfTextExtractor.js';
import { isMongoNativeConfigured } from '../../db/mongoClient.js';
import { getTenantCollections } from '../../tenancy/getTenantCollections.js';
import {
  tenantScopeFilterFromContext,
} from '../../tenancy/tenantQuery.js';
import type { MongoDocument, MongoDocumentVersion } from '../../db/types.js';
import {
  buildMetadataSummary,
} from '../utils/versionComparison.js';
import {
  nextMajorVersionLabel,
  normalizeVersionLabel,
} from '../../utils/versionLabelUtils.js';
import type { PreviousVersionContext } from '../utils/updateExtractorPrompt.js';

type AnalyzeRequestContext = {
  requestId?: string;
  batchId?: string;
  itemId?: string;
  fileName?: string;
};

function createLog(
  title: string,
  description: string,
  status: ProcessingLogItem['status'],
): ProcessingLogItem {
  return { title, description, status };
}

function validatePdfUpload(input: {
  buffer: Buffer;
  originalFileName: string;
  mimeType: string;
}): void {
  if (!input.buffer.length) {
    throw new AiAnalysisError(AI_ERROR_MESSAGES.emptyFile, 'EMPTY_FILE', 400);
  }

  if (input.buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new AiAnalysisError(AI_ERROR_MESSAGES.fileTooLarge, 'FILE_TOO_LARGE', 400);
  }

  const lowerName = input.originalFileName.toLowerCase();
  if (!lowerName.endsWith('.pdf')) {
    throw new AiAnalysisError(AI_ERROR_MESSAGES.pdfOnly, 'INVALID_EXTENSION', 400);
  }

  const mime = input.mimeType.toLowerCase();
  if (
    mime &&
    mime !== 'application/octet-stream' &&
    !ALLOWED_MIME_TYPES.includes(mime as (typeof ALLOWED_MIME_TYPES)[number])
  ) {
    throw new AiAnalysisError(AI_ERROR_MESSAGES.pdfOnly, 'INVALID_MIME', 400);
  }
}

async function loadPreviousVersionContext(input: {
  documentId: string;
  tenantId: string;
  ownerUserId?: string;
  membershipId?: string;
}): Promise<{
  document: MongoDocument;
  version: MongoDocumentVersion;
  context: PreviousVersionContext;
}> {
  if (!isMongoNativeConfigured()) {
    throw new AiAnalysisError(
      'Persistência indisponível para análise de atualização.',
      'MONGODB_NOT_CONFIGURED',
      503,
    );
  }

  const collections = await getTenantCollections(input.tenantId, {
    userId: input.ownerUserId,
    membershipId: input.membershipId,
  });

  const doc = await collections.documents.findOne({
    _id: input.documentId,
    ...tenantScopeFilterFromContext(collections.storage),
    deletedAt: { $in: [null, undefined] },
  } as Record<string, unknown>);

  if (!doc) {
    throw new AiAnalysisError('Documento não encontrado.', 'DOCUMENT_NOT_FOUND', 404);
  }

  const mongoDoc = doc as MongoDocument;
  const version = await collections.documentVersions.findOne({
    _id: mongoDoc.currentVersionId,
    documentId: input.documentId,
    ...tenantScopeFilterFromContext(collections.storage),
  } as Record<string, unknown>);

  if (!version) {
    throw new AiAnalysisError('Versão atual não encontrada.', 'VERSION_NOT_FOUND', 404);
  }

  const mongoVersion = version as MongoDocumentVersion;
  const currentVersionLabel = normalizeVersionLabel(
    mongoDoc.currentVersionLabel ?? mongoVersion.versionLabel,
  );
  const expectedNextVersionLabel = nextMajorVersionLabel(currentVersionLabel);
  const metadataPreview: Record<string, string | number | null> = {};
  for (const [key, field] of Object.entries(mongoVersion.metadata ?? {})) {
    metadataPreview[key] = field.normalizedValue ?? field.value;
  }

  return {
    document: mongoDoc,
    version: mongoVersion,
    context: {
      documentId: input.documentId,
      currentVersionLabel,
      expectedNextVersionLabel,
      documentName: mongoDoc.currentFileName ?? mongoVersion.finalFileName,
      categoryName: mongoDoc.className,
      metadataSummary: buildMetadataSummary(mongoVersion.metadata ?? {}, mongoDoc.className),
      metadataPreview,
    },
  };
}

export async function analyzePdfUpdateBuffer(input: {
  buffer: Buffer;
  originalFileName: string;
  mimeType: string;
  companyId: string;
  documentId: string;
  ownerUserId?: string;
  membershipId?: string;
  jobId?: string;
  requestContext?: AnalyzeRequestContext;
}): Promise<AnalyzePdfUpdateResponse> {
  assertAiProviderConfigured();
  validatePdfUpload(input);

  const jobId = input.jobId ?? `job_${randomUUID()}`;
  const logs: ProcessingLogItem[] = [];
  const fileHash = createHash('sha256').update(input.buffer).digest('hex');
  const fileSizeBytes = input.buffer.length;
  const documentId = input.documentId.trim();

  if (!documentId) {
    throw new AiAnalysisError('documentId é obrigatório para atualização.', 'DOCUMENT_ID_REQUIRED', 400);
  }

  const previous = await loadPreviousVersionContext({
    documentId,
    tenantId: input.companyId,
    ownerUserId: input.ownerUserId,
    membershipId: input.membershipId,
  });

  logs.push(
    createLog(
      'Contexto da versão anterior carregado',
      `Versão atual ${previous.context.currentVersionLabel}; próxima esperada ${previous.context.expectedNextVersionLabel}.`,
      'done',
    ),
  );

  let extracted;
  try {
    extracted = await extractTextFromPdf(input.buffer);
  } catch {
    throw new AiAnalysisError(AI_ERROR_MESSAGES.insufficientText, 'TEXT_EXTRACTION_FAILED', 422);
  }

  if (extracted.charCount < MIN_TEXT_CHARS) {
    throw new AiAnalysisError(AI_ERROR_MESSAGES.insufficientText, 'INSUFFICIENT_TEXT', 422);
  }

  logs.push(createLog('Texto extraído', 'Conteúdo do novo arquivo extraído para análise.', 'done'));

  let rulesLoad;
  try {
    rulesLoad = await loadActiveDocumentClassRules(input.companyId, {
      ownerUserId: input.ownerUserId,
    });
  } catch (error) {
    if (isDocumentRulesNotSeededError(error)) {
      const userMessage =
        error.reason === 'no_extraction_rules'
          ? AI_ERROR_MESSAGES.rulesNoExtraction
          : error.reason === 'no_categories'
            ? AI_ERROR_MESSAGES.rulesNoCategories
            : AI_ERROR_MESSAGES.rulesNotSeeded;
      throw new AiAnalysisError(userMessage, error.code, error.statusCode);
    }
    throw error;
  }

  const documentClassRules = rulesLoad.rules;
  const chunks = createDocumentChunks(extracted);
  const classificationChunks = selectChunksForClassification({
    chunks,
    classes: documentClassRules,
  });

  const classification = await resolveAnalysisProvider().classify({
    chunks: classificationChunks,
    classes: documentClassRules,
    context: {
      requestId: input.requestContext?.requestId,
      jobId,
      companyId: input.companyId,
      database: rulesLoad.database,
    },
  });

  if (classification.errorCode === 'GROQ_RATE_LIMIT' || classification.errorCode === 'GROQ_DAILY_TOKEN_LIMIT' || classification.errorCode === 'GROQ_CONTEXT_LIMIT') {
    return {
      jobId,
      status: 'ai_unavailable',
      updateMode: true,
      documentId,
      currentVersionLabel: previous.context.currentVersionLabel,
      expectedNextVersionLabel: previous.context.expectedNextVersionLabel,
      previousVersionContextIncluded: true,
      originalFileName: input.originalFileName,
      fileHash,
      fileSizeBytes,
      recommendedFileName: null,
      textExtraction: {
        status: 'completed',
        pageCount: extracted.pageCount,
        charCount: extracted.charCount,
        truncated: extracted.truncated,
      },
      classification,
      extraction: null,
      logs,
      errorCode: 'GROQ_RATE_LIMIT',
    };
  }

  if (classification.requiresReview || !classification.classId) {
    logs.push(createLog('Revisão necessária', classification.reason, 'done'));
    return {
      jobId,
      status: 'requires_review',
      updateMode: true,
      documentId,
      currentVersionLabel: previous.context.currentVersionLabel,
      expectedNextVersionLabel: previous.context.expectedNextVersionLabel,
      previousVersionContextIncluded: true,
      originalFileName: input.originalFileName,
      fileHash,
      fileSizeBytes,
      recommendedFileName: null,
      textExtraction: {
        status: 'completed',
        pageCount: extracted.pageCount,
        charCount: extracted.charCount,
        truncated: extracted.truncated,
      },
      classification,
      extraction: null,
      logs,
    };
  }

  const selectedClass = getDocumentClassRuleById(documentClassRules, classification.classId);
  if (!selectedClass) {
    return {
      jobId,
      status: 'requires_review',
      updateMode: true,
      documentId,
      currentVersionLabel: previous.context.currentVersionLabel,
      expectedNextVersionLabel: previous.context.expectedNextVersionLabel,
      previousVersionContextIncluded: true,
      originalFileName: input.originalFileName,
      fileHash,
      fileSizeBytes,
      recommendedFileName: null,
      textExtraction: {
        status: 'completed',
        pageCount: extracted.pageCount,
        charCount: extracted.charCount,
        truncated: extracted.truncated,
      },
      classification: {
        ...classification,
        classId: null,
        className: null,
        requiresReview: true,
        reason: 'A classe retornada não está entre as regras configuradas.',
      },
      extraction: null,
      logs,
    };
  }

  const extractionClass = augmentConfidentialityClassForExtraction(selectedClass);
  const extractionChunks = selectChunksForExtraction({
    chunks,
    selectedClass: extractionClass,
  });

  logger.debug('Retrieval híbrido (update) concluído', buildRetrievalStats({
    totalChunks: chunks.length,
    classificationChunks,
    extractionChunks,
  }));

  const extraction = await extractMetadataForVersionUpdate({
    chunks: extractionChunks,
    selectedClass: extractionClass,
    classification,
    previousVersion: previous.context,
    previousMetadata: previous.version.metadata ?? {},
    context: {
      requestId: input.requestContext?.requestId,
      jobId,
      companyId: input.companyId,
      database: rulesLoad.database,
    },
  });

  const enrichedMetadata = enrichMetadataWithPartyHeuristics({
    chunks: extractionChunks,
    selectedClass,
    metadata: extraction.metadata,
  });

  extraction.metadata = enrichedMetadata;

  const recommendedFileName = generateRecommendedFileName({
    originalFileName: input.originalFileName,
    selectedClass,
    metadata: enrichedMetadata,
    version: extraction.version,
    sourceChunks: extractionChunks,
  });

  const requiresReview =
    extraction.requiresReview ||
    classification.requiresReview ||
    !extraction.seemsSameDocument ||
    extraction.sameDocumentConfidence < 0.55;

  if (!extraction.seemsSameDocument) {
    logs.push(
      createLog(
        'Alerta: possível documento diferente',
        'O modelo indicou baixa confiança de continuidade — revisão manual obrigatória.',
        'done',
      ),
    );
  }

  if (extraction.mainChanges.length > 0) {
    logs.push(
      createLog(
        'Mudanças identificadas',
        extraction.mainChanges.slice(0, 3).join(' | '),
        'done',
      ),
    );
  }

  logs.push(
    createLog(
      requiresReview ? 'Revisão necessária' : 'Pronto para confirmação',
      requiresReview
        ? extraction.reviewReasons[0] ?? 'Nova versão requer revisão manual.'
        : `Nova versão ${extraction.version} pronta para confirmação.`,
      'done',
    ),
  );

  return {
    jobId,
    status: requiresReview ? 'requires_review' : 'completed',
    updateMode: true,
    documentId,
    currentVersionLabel: previous.context.currentVersionLabel,
    expectedNextVersionLabel: previous.context.expectedNextVersionLabel,
    previousVersionContextIncluded: true,
    originalFileName: input.originalFileName,
    fileHash,
    fileSizeBytes,
    recommendedFileName,
    textExtraction: {
      status: 'completed',
      pageCount: extracted.pageCount,
      charCount: extracted.charCount,
      truncated: extracted.truncated,
    },
    classification,
    extraction,
    logs,
  };
}
