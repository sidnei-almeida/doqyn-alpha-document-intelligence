import type { ClassificationResult, DocumentClassRule, RetrievedChunk } from '../types/documentAi.types.js';
import { AI_ERROR_MESSAGES } from '../constants.js';
import {
  diagnoseClassifierError,
  sanitizeDiagnosticText,
  type ClassifierFailureCode,
} from '../utils/classifierDiagnostics.js';
import {
  buildCompactClassifierPrompt,
  estimateLegacyClassifierPromptChars,
} from '../utils/classifierPrompt.js';
import { safeParseJsonFromModel } from '../utils/jsonParsing.js';
import { validateClassificationResult } from '../utils/validation.js';
import { logger } from '../../utils/logger.js';
import { completeJsonPrompt, getGroqClassifierModel, type GroqPromptContext } from './groqClient.js';
import { AiAnalysisError } from '../utils/errors.js';
import { isConfidentialityClassRule } from '../utils/documentClassHeuristics.js';

export type ClassifierContext = GroqPromptContext & {
  classesAvailableCount?: number;
  classIds?: string[];
};

function reviewResult(reason: string, extra?: Partial<ClassificationResult>): ClassificationResult {
  return {
    classId: null,
    className: null,
    confidence: 0,
    requiresReview: true,
    reason,
    evidence: [],
    ...extra,
  };
}

function rateLimitResult(
  errorCode: 'GROQ_RATE_LIMIT' | 'GROQ_DAILY_TOKEN_LIMIT' | 'GROQ_CONTEXT_LIMIT',
): ClassificationResult {
  const reason =
    errorCode === 'GROQ_DAILY_TOKEN_LIMIT'
      ? AI_ERROR_MESSAGES.groqDailyTokenLimit
      : errorCode === 'GROQ_CONTEXT_LIMIT'
        ? AI_ERROR_MESSAGES.groqContextLimit
        : AI_ERROR_MESSAGES.aiUnavailable;

  return reviewResult(reason, {
    errorCode,
    reviewReason: reason,
  });
}

function logClassifierFailure(
  context: ClassifierContext | undefined,
  diagnostic: ReturnType<typeof diagnoseClassifierError>,
  extra: Record<string, unknown>,
) {
  logger.error('document classifier failed', {
    requestId: context?.requestId,
    jobId: context?.jobId,
    companyId: context?.companyId,
    database: context?.database,
    classesAvailableCount: context?.classesAvailableCount,
    classIds: context?.classIds,
    classifierModel: getGroqClassifierModel(),
    errorName: diagnostic.errorName,
    errorCode: diagnostic.code,
    errorMessage: diagnostic.internalMessage,
    httpStatus: diagnostic.httpStatus,
    groqErrorCode: diagnostic.groqErrorCode,
    groqCalled: true,
    parseFailed: extra.parseFailed ?? false,
    validationFailed: extra.validationFailed ?? false,
    ...extra,
  });
}

export async function classifyDocumentWithRules(input: {
  chunks: RetrievedChunk[];
  classes: DocumentClassRule[];
  context?: ClassifierContext;
}): Promise<ClassificationResult> {
  const allowedClassIds = input.classes.map((c) => c.id);
  const context: ClassifierContext = {
    ...input.context,
    classesAvailableCount: input.classes.length,
    classIds: allowedClassIds,
  };
  const hasConfidentialityClass = input.classes.some((item) => isConfidentialityClassRule(item));

  const { prompt, compactChunks, compactClasses } = buildCompactClassifierPrompt(
    input.chunks,
    input.classes,
  );
  const selectedChunksCount = compactChunks.length;
  const totalContextChars = compactChunks.reduce((sum, chunk) => sum + chunk.text.length, 0);
  const classifierPromptCharsBefore = estimateLegacyClassifierPromptChars(input.chunks, input.classes);
  const classifierPromptCharsAfter = prompt.length;
  const classesSentCount = compactClasses.length;

  logger.info('document classifier request started', {
    requestId: context.requestId,
    jobId: context.jobId,
    companyId: context.companyId,
    database: context.database,
    classifierModel: getGroqClassifierModel(),
    classesAvailableCount: context.classesAvailableCount,
    classesSentCount,
    classIds: context.classIds,
    hasConfidentialityClass,
    selectedChunksCount,
    totalContextChars,
    emptyChunks: selectedChunksCount === 0,
    classifierPromptCharsBefore,
    classifierPromptCharsAfter,
  });

  if (selectedChunksCount === 0 || totalContextChars === 0) {
    logger.warn('document classifier skipped — empty context', {
      requestId: context.requestId,
      jobId: context.jobId,
      selectedChunksCount,
      totalContextChars,
    });
    return reviewResult(AI_ERROR_MESSAGES.classificationFailed);
  }

  const groqStartedAt = Date.now();

  try {
    const raw = await completeJsonPrompt(prompt, {
      context: {
        ...context,
        operation: 'document_classification',
      },
    });

    logger.info('document classifier groq response received', {
      requestId: context.requestId,
      jobId: context.jobId,
      companyId: context.companyId,
      groqCalled: true,
      groqDurationMs: Date.now() - groqStartedAt,
      responseChars: raw.length,
      responsePreview: sanitizeDiagnosticText(raw, 180),
      classifierPromptCharsAfter,
      selectedChunksCount,
      classesSentCount,
    });

    const parsed = safeParseJsonFromModel<Record<string, unknown>>(raw);
    if (!parsed) {
      logClassifierFailure(context, {
        code: 'CLASSIFIER_INVALID_JSON',
        internalMessage: 'Classifier returned invalid JSON',
      }, {
        parseFailed: true,
        validationFailed: false,
        groqDurationMs: Date.now() - groqStartedAt,
      });
      return reviewResult(AI_ERROR_MESSAGES.classificationFailed);
    }

    const returnedClassId =
      typeof parsed.classId === 'string' && parsed.classId.trim() ? parsed.classId.trim() : null;

    const result = validateClassificationResult(parsed, allowedClassIds);

    if (returnedClassId && !allowedClassIds.includes(returnedClassId)) {
      logClassifierFailure(
        context,
        {
          code: 'CLASSIFIER_CLASS_NOT_ALLOWED',
          internalMessage: 'Classifier returned classId not allowed',
        },
        {
          parseFailed: false,
          validationFailed: true,
          returnedClassId,
          groqDurationMs: Date.now() - groqStartedAt,
        },
      );
      return reviewResult(AI_ERROR_MESSAGES.classificationFailed);
    }

    if (!returnedClassId && result.requiresReview) {
      logger.info('document classifier completed with review', {
        requestId: context.requestId,
        jobId: context.jobId,
        companyId: context.companyId,
        confidence: result.confidence,
        requiresReview: true,
        groqDurationMs: Date.now() - groqStartedAt,
        internalReason: sanitizeDiagnosticText(result.reason, 200),
      });
      return {
        ...result,
        reason: AI_ERROR_MESSAGES.classificationFailed,
        reviewReason: result.reason,
      };
    }

    logger.info('document classifier completed', {
      requestId: context.requestId,
      jobId: context.jobId,
      companyId: context.companyId,
      classId: result.classId,
      className: result.className,
      confidence: result.confidence,
      requiresReview: result.requiresReview,
      groqDurationMs: Date.now() - groqStartedAt,
      classifierPromptCharsBefore,
      classifierPromptCharsAfter,
      selectedChunksCount,
      classesSentCount,
    });

    return result;
  } catch (error) {
    const diagnostic = diagnoseClassifierError(error);

    if (
      diagnostic.code === 'GROQ_RATE_LIMIT' ||
      diagnostic.code === 'GROQ_DAILY_TOKEN_LIMIT' ||
      diagnostic.code === 'GROQ_CONTEXT_LIMIT' ||
      (error instanceof AiAnalysisError &&
        (error.code === 'GROQ_RATE_LIMIT' ||
          error.code === 'GROQ_DAILY_TOKEN_LIMIT' ||
          error.code === 'GROQ_CONTEXT_LIMIT'))
    ) {
      logClassifierFailure(context, diagnostic, {
        groqDurationMs: Date.now() - groqStartedAt,
        parseFailed: false,
        validationFailed: false,
        rateLimit: true,
      });
      const errorCode =
        diagnostic.code === 'GROQ_DAILY_TOKEN_LIMIT'
          ? 'GROQ_DAILY_TOKEN_LIMIT'
          : diagnostic.code === 'GROQ_CONTEXT_LIMIT'
            ? 'GROQ_CONTEXT_LIMIT'
            : 'GROQ_RATE_LIMIT';
      return rateLimitResult(errorCode);
    }

    logClassifierFailure(context, diagnostic, {
      groqDurationMs: Date.now() - groqStartedAt,
      parseFailed: false,
      validationFailed: false,
    });

    return reviewResult(AI_ERROR_MESSAGES.classificationFailed);
  }
}

export type { ClassifierFailureCode };
