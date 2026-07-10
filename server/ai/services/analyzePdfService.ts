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
import type { AnalyzePdfResponse, ProcessingLogItem } from '../types/documentAi.types.js';
import { AiAnalysisError } from '../utils/errors.js';
import { assertAiProviderConfigured } from '../utils/aiProvider.js';
import { classifyDocumentWithRules } from './documentClassifierAgent.js';
import { createDocumentChunks } from './documentChunker.js';
import { extractMetadataWithRule } from './metadataExtractorAgent.js';
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
type AnalyzeRequestContext = {
  requestId?: string;
  batchId?: string;
  itemId?: string;
  fileName?: string;
};

type StageDurationsMs = {
  validation?: number;
  textExtraction?: number;
  rulesLoad?: number;
  chunking?: number;
  retrieval?: number;
  classification?: number;
  extraction?: number;
  finalization?: number;
  total?: number;
};

function createLog(
  title: string,
  description: string,
  status: ProcessingLogItem['status'],
): ProcessingLogItem {
  return { title, description, status };
}

function createStageTimer() {
  const startedAt = Date.now();
  let lastMark = startedAt;
  const durations: StageDurationsMs = {};

  return {
    mark(stage: keyof StageDurationsMs) {
      const now = Date.now();
      durations[stage] = now - lastMark;
      lastMark = now;
    },
    finish() {
      durations.total = Date.now() - startedAt;
      return durations;
    },
  };
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

function logAnalyzeStage(
  message: string,
  context: AnalyzeRequestContext,
  details: Record<string, unknown>,
) {
  logger.info(message, {
    requestId: context.requestId,
    batchId: context.batchId,
    itemId: context.itemId,
    fileName: context.fileName,
    ...details,
  });
}

export async function analyzePdfBuffer(input: {
  buffer: Buffer;
  originalFileName: string;
  mimeType: string;
  companyId: string;
  ownerUserId?: string;
  requestContext?: AnalyzeRequestContext;
}): Promise<AnalyzePdfResponse> {
  assertAiProviderConfigured();

  const jobId = `job_${randomUUID()}`;
  const logs: ProcessingLogItem[] = [];
  const fileHash = createHash('sha256').update(input.buffer).digest('hex');
  const fileSizeBytes = input.buffer.length;
  const context: AnalyzeRequestContext = {
    ...input.requestContext,
    fileName: input.requestContext?.fileName ?? input.originalFileName,
  };

  validatePdfUpload(input);

  const timer = createStageTimer();
  let groqCalled = false;
  let textCharCount = 0;
  let chunksCount = 0;

  logAnalyzeStage('analyze-pdf arquivo recebido', context, {
    fileSizeBytes,
    mimeType: input.mimeType,
    companyId: input.companyId,
  });

  timer.mark('validation');

  logs.push(createLog('Documento recebido', 'O PDF foi recebido com sucesso.', 'done'));

  const rulesLoadPromise = loadActiveDocumentClassRules(input.companyId, {
    ownerUserId: input.ownerUserId,
  });

  let extracted;
  try {
    extracted = await extractTextFromPdf(input.buffer);
  } catch {
    const durations = timer.finish();
    logAnalyzeStage('analyze-pdf extração de texto falhou', context, {
      textCharCount: 0,
      groqCalled,
      stageDurationsMs: durations,
      reason: 'TEXT_EXTRACTION_FAILED',
    });
    throw new AiAnalysisError(AI_ERROR_MESSAGES.insufficientText, 'TEXT_EXTRACTION_FAILED', 422);
  }

  textCharCount = extracted.charCount;
  const pageCount = extracted.pageCount;
  timer.mark('textExtraction');

  logAnalyzeStage('analyze-pdf texto extraído', context, {
    textCharCount,
    pageCount,
    truncated: extracted.truncated,
  });

  if (extracted.charCount < MIN_TEXT_CHARS) {
    const durations = timer.finish();
    logAnalyzeStage('analyze-pdf texto insuficiente', context, {
      textCharCount,
      pageCount,
      minRequired: MIN_TEXT_CHARS,
      groqCalled,
      stageDurationsMs: durations,
      reason: 'INSUFFICIENT_TEXT',
    });
    throw new AiAnalysisError(AI_ERROR_MESSAGES.insufficientText, 'INSUFFICIENT_TEXT', 422);
  }

  logs.push(
    createLog(
      'Texto extraído',
      extracted.truncated
        ? 'O conteúdo textual do PDF foi extraído para análise (texto truncado por limite de tamanho).'
        : 'O conteúdo textual do PDF foi extraído para análise.',
      'done',
    ),
  );

  let rulesLoad;
  try {
    rulesLoad = await rulesLoadPromise;
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
  timer.mark('rulesLoad');

  if (rulesLoad.usedMockFallback) {
    logger.warn('Usando fallback mock de regras porque MongoDB não retornou classes ativas.', {
      requestId: context.requestId,
      batchId: context.batchId,
      itemId: context.itemId,
      fileName: context.fileName,
      companyId: rulesLoad.companyId,
      database: rulesLoad.database,
      mockFallbackReason: rulesLoad.mockFallbackReason,
      mockClassesCount: rulesLoad.rules.length,
    });
    logs.push(
      createLog(
        'Regras em modo mock',
        'As regras vieram do fallback local porque o MongoDB não está configurado.',
        'done',
      ),
    );
  } else {
    logAnalyzeStage('analyze-pdf regras carregadas do MongoDB', context, {
      database: rulesLoad.database,
      activeCategoriesCount: rulesLoad.activeCategoriesCount,
      activeRulesCount: rulesLoad.activeExtractionRulesCount,
      activeAccessRulesCount: rulesLoad.activeAccessRulesCount,
      collectionsConsulted: rulesLoad.collectionsConsulted,
      rulesSource: rulesLoad.source,
      mappedRulesCount: documentClassRules.length,
    }    );
  }

  const chunks = createDocumentChunks(extracted);
  chunksCount = chunks.length;
  timer.mark('chunking');

  const classificationChunks = selectChunksForClassification({
    chunks,
    classes: documentClassRules,
  });

  logs.push(
    createLog(
      'Trechos relevantes selecionados',
      `${classificationChunks.length} trecho(s) selecionado(s) para análise com base nas regras da empresa.`,
      'done',
    ),
  );
  timer.mark('retrieval');

  groqCalled = true;
  const classification = await classifyDocumentWithRules({
    chunks: classificationChunks,
    classes: documentClassRules,
    context: {
      requestId: context.requestId,
      jobId,
      companyId: input.companyId,
      database: rulesLoad.database,
    },
  });
  timer.mark('classification');

  if (
    classification.errorCode === 'GROQ_RATE_LIMIT' ||
    classification.errorCode === 'GROQ_DAILY_TOKEN_LIMIT' ||
    classification.errorCode === 'GROQ_CONTEXT_LIMIT'
  ) {
    const durations = timer.finish();
    logAnalyzeStage('analyze-pdf IA indisponível (limite Groq)', context, {
      textCharCount,
      pageCount,
      chunksCount,
      groqCalled,
      errorCode: classification.errorCode,
      stageDurationsMs: durations,
    });

    logs.push(
      createLog(
        'Análise automática indisponível',
        classification.reason || AI_ERROR_MESSAGES.aiUnavailable,
        'error',
      ),
    );

    return {
      jobId,
      status: 'ai_unavailable',
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
      errorCode: classification.errorCode,
    };
  }

  if (classification.requiresReview || !classification.classId) {
    const durations = timer.finish();
    logAnalyzeStage('analyze-pdf revisão necessária após classificação', context, {
      textCharCount,
      pageCount,
      chunksCount,
      groqCalled,
      className: classification.className,
      confidence: classification.confidence,
      requiresReview: classification.requiresReview,
      reason: classification.reason,
      stageDurationsMs: durations,
    });

    logs.push(
      createLog(
        'Revisão necessária',
        classification.reason ||
          'Nenhuma classe foi identificada com confiança suficiente.',
        'done',
      ),
    );

    return {
      jobId,
      status: 'requires_review',
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

  logs.push(
    createLog(
      'Classe identificada',
      `O documento foi classificado como "${classification.className}" com base nas regras da empresa.`,
      'done',
    ),
  );

  const selectedClass = getDocumentClassRuleById(documentClassRules, classification.classId);
  if (!selectedClass) {
    const durations = timer.finish();
    logAnalyzeStage('analyze-pdf classe fora das regras configuradas', context, {
      textCharCount,
      pageCount,
      chunksCount,
      groqCalled,
      classId: classification.classId,
      className: classification.className,
      rulesSource: rulesLoad.source,
      stageDurationsMs: durations,
    });

    logs.push(
      createLog(
        'Revisão necessária',
        'A classe retornada não está entre as regras configuradas.',
        'done',
      ),
    );

    return {
      jobId,
      status: 'requires_review',
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
        evidence: classification.evidence,
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

  logger.debug('Retrieval híbrido concluído', buildRetrievalStats({
    totalChunks: chunks.length,
    classificationChunks,
    extractionChunks,
  }));

  const extraction = await extractMetadataWithRule({
    chunks: extractionChunks,
    selectedClass: extractionClass,
    classification,
    context: {
      requestId: context.requestId,
      jobId,
      companyId: input.companyId,
      database: rulesLoad.database,
    },
  });
  timer.mark('extraction');

  const enrichedMetadata = enrichMetadataWithPartyHeuristics({
    chunks: extractionChunks,
    selectedClass,
    metadata: extraction.metadata,
  });

  logs.push(
    createLog(
      'Metadados extraídos',
      extraction.missingFields.length
        ? `Os campos configurados foram extraídos em JSON. Campos ausentes: ${extraction.missingFields.join(', ')}.`
        : 'Os campos configurados foram extraídos em JSON.',
      'done',
    ),
  );

  const recommendedFileName = generateRecommendedFileName({
    originalFileName: input.originalFileName,
    selectedClass,
    metadata: enrichedMetadata,
    version: extraction.version,
    sourceChunks: extractionChunks,
  });

  logs.push(
    createLog(
      'Nome recomendado gerado',
      'O nome do arquivo foi gerado automaticamente com base nos metadados.',
      'done',
    ),
  );

  const requiresReview = extraction.requiresReview || classification.requiresReview;
  const status = requiresReview ? 'requires_review' : 'completed';
  timer.mark('finalization');

  const durations = timer.finish();
  logAnalyzeStage('analyze-pdf concluído', context, {
    textCharCount,
    pageCount,
    chunksCount,
    groqCalled,
    status,
    classId: classification.classId,
    className: classification.className,
    confidence: classification.confidence,
    requiresReview,
    rulesSource: rulesLoad.source,
    stageDurationsMs: durations,
  });

  if (requiresReview) {
    logs.push(
      createLog(
        'Revisão necessária',
        extraction.reviewReasons[0] ||
          classification.reason ||
          'Este documento precisa de revisão manual antes de ser confirmado.',
        'done',
      ),
    );
  } else {
    logs.push(
      createLog(
        'Pronto para confirmação',
        'O resultado está pronto para revisão e confirmação.',
        'done',
      ),
    );
  }

  return {
    jobId,
    status,
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
