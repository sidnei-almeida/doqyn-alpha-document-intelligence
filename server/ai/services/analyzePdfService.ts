import { createHash, randomUUID } from 'node:crypto';
import { AI_ERROR_MESSAGES, MIN_TEXT_CHARS } from '../constants.js';
import {
  loadActiveDocumentClassRules,
  getDocumentClassRuleById,
  isDocumentRulesNotSeededError,
} from '../../services/documentRulesService.js';
import type {
  AnalyzePdfResponse,
  ClassificationResult,
  DocumentClassRule,
  DocumentNamingRoles,
  ProcessingLogItem,
  RetrievedChunk,
} from '../types/documentAi.types.js';
import { AiAnalysisError } from '../utils/errors.js';
import { assertAiProviderConfigured } from '../utils/aiProvider.js';
import { resolveAnalysisProvider } from '../providers/resolveAnalysisProvider.js';
import { createDocumentChunks } from './documentChunker.js';
import { generateRecommendedFileName } from './documentNaming.js';
import { augmentConfidentialityClassForExtraction } from '../utils/documentClassHeuristics.js';
import { enrichMetadataWithPartyHeuristics } from '../utils/partyMetadataHeuristics.js';
import {
  buildRetrievalStats,
  selectChunksForClassification,
  selectChunksForExtraction,
} from '../../services/retrievalProvider.js';
import { logger } from '../../utils/logger.js';
import { extractTextFromDocument } from './documentTextExtractor.js';
import {
  buildTextExtractionReviewResponse,
  isInsufficientTextAfterOcr,
  isVisionOcrFailure,
} from './visionOcrFailureReview.js';
import { bufferMeta, pipelineInfo, pipelineWarn, previewText } from '../utils/pipelineDebug.js';
import {
  getExtractionTokenBudget,
  getGroqModelFromEnv,
  isExtractionRefinementEnabled,
} from '../utils/aiConfig.js';
import { createTokenBudget } from '../utils/tokenBudget.js';
import { refineExtraction } from './extractionRefinementLoop.js';
import { reviewFailedClassification } from './classificationReviewAgent.js';
import {
  type AnalyzeRequestContext,
  createLog,
  logAnalyzeStage,
  validateAnalysisUpload,
} from './pdfAnalysisHelpers.js';

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

/**
 * Classe de mentira, usada só para pedir ao extrator o que ele entendeu do documento.
 *
 * Não tem campo nenhum de propósito: o que interessa dela é o bloco `naming`
 * (tipo, sujeitos, data), que o prompt do extrator preenche a partir da leitura
 * e não da classe. Campos autorados aqui só gastariam contexto pedindo dado que
 * ninguém configurou.
 */
const UNCLASSIFIED_NAMING_CLASS: DocumentClassRule = {
  id: '__sem_classe__',
  name: 'Documento',
  description: 'Documento sem classe determinada. Descreva o que ele é.',
  keywords: [],
  fields: [],
  namingTemplate: '{titulo}_{data_assinatura}_v{version}',
};

/**
 * Nome proposto para o documento que a classificação não soube encaixar.
 *
 * O nome vinha atrelado à classe: sem classe, `recommendedFileName` era `null` e
 * o arquivo ficava com o nome que veio do disco — `dwadaw.png` para um atestado
 * médico que a IA tinha lido inteiro e sabia descrever ("é um atestado médico,
 * não corresponde a nenhuma das classes definidas"). Duas perguntas diferentes
 * estavam amarradas: em que pasta isto mora, e como isto se chama. A segunda não
 * depende da primeira.
 *
 * Devolve `null` quando o extrator também não soube dizer o que é. Nome ruim
 * inventado sobre nada é pior que o nome original, que ao menos foi escolhido
 * por alguém.
 */
async function proposeNameWithoutClass(input: {
  analysisProvider: ReturnType<typeof resolveAnalysisProvider>;
  chunks: RetrievedChunk[];
  classification: ClassificationResult;
  originalFileName: string;
  context: { requestId?: string; jobId: string; companyId: string; database?: string };
}): Promise<{ fileName: string | null; roles: DocumentNamingRoles | undefined }> {
  try {
    const extraction = await input.analysisProvider.extractMetadata({
      chunks: input.chunks,
      selectedClass: UNCLASSIFIED_NAMING_CLASS,
      classification: input.classification,
      context: input.context,
    });

    const roles = extraction.naming;
    if (!roles?.tipo || (roles.sujeitos.length === 0 && !roles.dataReferencia)) {
      return { fileName: null, roles };
    }

    return {
      fileName: generateRecommendedFileName({
        originalFileName: input.originalFileName,
        selectedClass: UNCLASSIFIED_NAMING_CLASS,
        metadata: {},
        version: extraction.version,
        namingRoles: roles,
      }),
      roles,
    };
  } catch (error) {
    // Falhar aqui não pode derrubar a análise: o documento já vai para revisão
    // de qualquer jeito, e sem nome proposto ele apenas volta ao que era antes.
    logger.warn('nome sem classe não pôde ser proposto', {
      jobId: input.context.jobId,
      companyId: input.context.companyId,
      errorName: (error as Error)?.name,
      errorMessage: (error as Error)?.message,
    });
    return { fileName: null, roles: undefined };
  }
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

export async function analyzePdfBuffer(input: {
  buffer: Buffer;
  originalFileName: string;
  mimeType: string;
  companyId: string;
  ownerUserId?: string;
  jobId?: string;
  requestContext?: AnalyzeRequestContext;
}): Promise<AnalyzePdfResponse> {
  assertAiProviderConfigured();
  const analysisProvider = resolveAnalysisProvider();

  const jobId = input.jobId?.trim() || `job_${randomUUID()}`;
  const logs: ProcessingLogItem[] = [];
  const fileHash = createHash('sha256').update(input.buffer).digest('hex');
  const fileSizeBytes = input.buffer.length;
  const context: AnalyzeRequestContext = {
    ...input.requestContext,
    fileName: input.requestContext?.fileName ?? input.originalFileName,
  };

  pipelineInfo('analyzePdf', 'JOB INÍCIO', {
    jobId,
    companyId: input.companyId,
    ownerUserId: input.ownerUserId,
    originalFileName: input.originalFileName,
    mimeType: input.mimeType,
    fileHashPrefix: fileHash.slice(0, 12),
    ...bufferMeta(input.buffer, 'pdf'),
    analysisProvider: analysisProvider.name,
    groqModel: getGroqModelFromEnv(),
    classifierModel: process.env.GROQ_CLASSIFIER_MODEL?.trim() || getGroqModelFromEnv(),
    extractorModel: process.env.GROQ_EXTRACTOR_MODEL?.trim() || getGroqModelFromEnv(),
    requestId: context.requestId,
    batchId: context.batchId,
    itemId: context.itemId,
  });

  const resolvedMimeType = validateAnalysisUpload(input);

  const timer = createStageTimer();
  let groqCalled = false;
  let textCharCount = 0;
  let chunksCount = 0;

  logAnalyzeStage('analyze-pdf arquivo recebido', context, {
    fileSizeBytes,
    mimeType: resolvedMimeType,
    companyId: input.companyId,
  });

  timer.mark('validation');

  logs.push(
    createLog(
      'Documento recebido',
      resolvedMimeType.startsWith('image/')
        ? 'A imagem foi recebida com sucesso.'
        : 'O PDF foi recebido com sucesso.',
      'done',
    ),
  );

  const rulesLoadPromise = loadActiveDocumentClassRules(input.companyId, {
    ownerUserId: input.ownerUserId,
  });

  let extracted;
  try {
    extracted = await extractTextFromDocument(input.buffer, resolvedMimeType);
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
    textSource: extracted.source,
    ocrFallbackUsed: extracted.ocrFallbackUsed,
    ocrPagesProcessed: extracted.ocrPagesProcessed,
    ocrDurationMs: extracted.ocrDurationMs,
  });

  if (extracted.charCount < MIN_TEXT_CHARS) {
    const durations = timer.finish();
    logAnalyzeStage('analyze-pdf texto insuficiente', context, {
      textCharCount,
      pageCount,
      minRequired: MIN_TEXT_CHARS,
      groqCalled,
      stageDurationsMs: durations,
      reason: isVisionOcrFailure(extracted) ? 'VISION_OCR_FAILED' : 'INSUFFICIENT_TEXT',
      ocrFallbackUsed: extracted.ocrFallbackUsed,
      ocrAttempted: extracted.ocrAttempted,
      ocrPagesProcessed: extracted.ocrPagesProcessed,
      ocrDurationMs: extracted.ocrDurationMs,
      ocrErrorCode: extracted.ocrErrorCode,
    });
    pipelineWarn('analyzePdf', 'ABORT — texto insuficiente após cascata', {
      jobId,
      textCharCount,
      pageCount,
      minRequired: MIN_TEXT_CHARS,
      textSource: extracted.source,
      ocrFallbackUsed: extracted.ocrFallbackUsed,
      ocrAttempted: extracted.ocrAttempted,
      ocrPagesProcessed: extracted.ocrPagesProcessed,
      ocrErrorCode: extracted.ocrErrorCode,
      textPreview: previewText(extracted.text, 200),
      stageDurationsMs: durations,
    });

    if (isInsufficientTextAfterOcr(extracted)) {
      return buildTextExtractionReviewResponse({
        jobId,
        originalFileName: input.originalFileName,
        fileHash,
        fileSizeBytes,
        extracted,
        logs,
        errorCode: isVisionOcrFailure(extracted) ? 'VISION_OCR_FAILED' : 'INSUFFICIENT_TEXT',
        reason: isVisionOcrFailure(extracted)
          ? AI_ERROR_MESSAGES.visionOcrFailed
          : AI_ERROR_MESSAGES.insufficientText,
      });
    }

    throw new AiAnalysisError(AI_ERROR_MESSAGES.insufficientText, 'INSUFFICIENT_TEXT', 422);
  }

  logs.push(
    createLog(
      'Texto extraído',
      extracted.ocrFallbackUsed
        ? extracted.truncated
          ? 'Texto obtido via OCR (Vision) — truncado por limite de páginas/tamanho.'
          : 'Texto obtido via OCR (Vision) a partir de PDF escaneado/imagem.'
        : extracted.truncated
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
    });
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
      `${classificationChunks.length} trecho(s) selecionado(s) para análise com base nas regras configuradas.`,
      'done',
    ),
  );
  timer.mark('retrieval');

  pipelineInfo('analyzePdf', 'pré-classificação', {
    jobId,
    rulesCount: documentClassRules.length,
    rulesSource: rulesLoad.source,
    chunksCount,
    classificationChunks: classificationChunks.length,
    classNames: documentClassRules.map((r) => r.name),
  });

  groqCalled = true;
  let classification = await analysisProvider.classify({
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

  pipelineInfo('analyzePdf', 'classificação concluída', {
    jobId,
    classId: classification.classId,
    className: classification.className,
    confidence: classification.confidence,
    requiresReview: classification.requiresReview,
    errorCode: classification.errorCode,
    reasonPreview: previewText(classification.reason, 160),
    evidenceCount: classification.evidence?.length ?? 0,
  });

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
        source: extracted.source,
        ocrFallbackUsed: extracted.ocrFallbackUsed,
      },
      classification,
      extraction: null,
      logs,
      errorCode: classification.errorCode,
    };
  }

  /**
   * Classe recusada não é o fim da linha.
   *
   * O primeiro classificador recusa por literalidade — a descrição da pasta não cita o tipo, e ele
   * conclui que o documento não pertence a lugar nenhum. `rh_02` mostrou o custo: o mesmo atestado
   * médico entrou em Recursos Humanos com 0.7 na variante imagem e foi recusado com 0.0 nas outras
   * duas, com OCR praticamente idêntico. Sem classe, a extração nem roda e o documento vai para
   * revisão sem um único campo — mesmo que o modelo já tenha lido o nome da médica e a data.
   *
   * A segunda opinião custa uma chamada e só nos documentos que já iam para revisão de qualquer
   * jeito. A revisão continua marcada: o ganho é o metadado, não a aprovação automática.
   */
  let rescuedClassification: ClassificationResult | null = null;
  if (
    (classification.requiresReview || !classification.classId) &&
    isExtractionRefinementEnabled()
  ) {
    const review = await reviewFailedClassification({
      chunks: classificationChunks,
      classes: documentClassRules,
      classification,
      context: {
        requestId: context.requestId,
        jobId,
        companyId: input.companyId,
        database: rulesLoad.database,
      },
    });

    if (review.classId) {
      logger.info('classificação resgatada na segunda opinião', {
        requestId: context.requestId,
        jobId,
        companyId: input.companyId,
        firstReason: classification.reason,
        classId: review.classId,
        className: review.className,
        confidence: review.confidence,
        tokens: review.usage.totalTokens,
      });

      rescuedClassification = {
        ...classification,
        classId: review.classId,
        className: review.className,
        confidence: review.confidence,
        reason: review.reason,
        // Continua em revisão de propósito: o primeiro classificador não teve certeza, e resgatar
        // a pasta não transforma dúvida em confirmação. O que muda é que agora há metadado e nome
        // para a pessoa conferir, em vez de uma tela vazia.
        requiresReview: true,
        reviewReason: 'Classe sugerida na segunda leitura — confirme antes de arquivar.',
      };
      classification = rescuedClassification;

      logs.push(
        createLog(
          'Classe sugerida na segunda leitura',
          `A primeira classificação não encontrou pasta. Uma segunda leitura sugere ${review.className}.`,
          'done',
        ),
      );
    }
  }

  if (!rescuedClassification && (classification.requiresReview || !classification.classId)) {
    const proposed = await proposeNameWithoutClass({
      analysisProvider,
      chunks: classificationChunks,
      classification,
      originalFileName: input.originalFileName,
      context: {
        requestId: context.requestId,
        jobId,
        companyId: input.companyId,
        database: rulesLoad.database,
      },
    });

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
      namingRolesType: proposed.roles?.tipo ?? null,
      recommendedFileName: proposed.fileName,
      stageDurationsMs: durations,
    });

    logs.push(
      createLog(
        'Revisão necessária',
        classification.reason || 'Nenhuma classe foi identificada com confiança suficiente.',
        'done',
      ),
    );

    if (proposed.fileName) {
      logs.push(
        createLog(
          'Nome sugerido mesmo sem classe',
          `A IA não encontrou classe para este documento, mas leu o que ele é e sugeriu "${proposed.fileName}". Escolha a pasta na revisão.`,
          'done',
        ),
      );
    }

    return {
      jobId,
      status: 'requires_review',
      originalFileName: input.originalFileName,
      fileHash,
      fileSizeBytes,
      recommendedFileName: proposed.fileName,
      textExtraction: {
        status: 'completed',
        pageCount: extracted.pageCount,
        charCount: extracted.charCount,
        truncated: extracted.truncated,
        source: extracted.source,
        ocrFallbackUsed: extracted.ocrFallbackUsed,
      },
      classification,
      extraction: null,
      logs,
    };
  }

  logs.push(
    createLog(
      'Classe identificada',
      `O documento foi classificado como "${classification.className}" com base nas regras configuradas.`,
      'done',
    ),
  );

  // Chegar aqui sem classId é impossível pelos ramos acima, mas o compilador não enxerga isso e
  // um `!` aqui esconderia uma regressão futura atrás de um crash em produção.
  const selectedClass = getDocumentClassRuleById(documentClassRules, classification.classId ?? '');
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
        source: extracted.source,
        ocrFallbackUsed: extracted.ocrFallbackUsed,
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

  logger.debug(
    'Retrieval híbrido concluído',
    buildRetrievalStats({
      totalChunks: chunks.length,
      classificationChunks,
      extractionChunks,
    }),
  );

  const refined = await refineExtraction({
    analysisProvider,
    // Os chunks inteiros, não a seleção: o passe focado re-seleciona por campo, com os termos que
    // o Avaliador escreveu, e re-selecionar dentro da seleção anterior repetiria o mesmo recorte
    // que já falhou.
    chunks,
    extractionChunks,
    selectedClass: extractionClass,
    classification,
    budget: createTokenBudget(getExtractionTokenBudget()),
    context: {
      requestId: context.requestId,
      jobId,
      companyId: input.companyId,
      database: rulesLoad.database,
    },
  });
  const extraction = refined.extraction;
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

  if (refined.trail.enabled && refined.trail.passes.length > 0) {
    logs.push(
      createLog(
        'Revisão automática da extração',
        refined.trail.recoveredFields.length
          ? `Uma segunda leitura recuperou: ${refined.trail.recoveredFields.join(', ')}.`
          : 'Os campos pendentes foram reprocurados e o documento realmente não os traz.',
        'done',
      ),
    );
  }

  const recommendedFileName = generateRecommendedFileName({
    originalFileName: input.originalFileName,
    selectedClass,
    metadata: enrichedMetadata,
    version: extraction.version,
    sourceChunks: extractionChunks,
    namingRoles: extraction.naming,
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

  pipelineInfo('analyzePdf', 'JOB FIM', {
    jobId,
    status,
    textCharCount,
    pageCount,
    chunksCount,
    textSource: extracted.source,
    ocrFallbackUsed: extracted.ocrFallbackUsed,
    classId: classification.classId,
    className: classification.className,
    classificationConfidence: classification.confidence,
    classificationRequiresReview: classification.requiresReview,
    extractionMissingFields: extraction.missingFields,
    extractionRequiresReview: extraction.requiresReview,
    refinement: {
      enabled: refined.trail.enabled,
      passes: refined.trail.passes.length,
      stopReason: refined.trail.stopReason,
      tokensSpent: refined.trail.tokensSpent,
      tokenBudget: refined.trail.tokenBudget,
      recoveredFields: refined.trail.recoveredFields,
      absentFields: refined.trail.absentFields,
    },
    recommendedFileName,
    metadataKeys: Object.keys(extraction.metadata ?? {}),
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
      source: extracted.source,
      ocrFallbackUsed: extracted.ocrFallbackUsed,
    },
    classification,
    extraction,
    logs,
  };
}
