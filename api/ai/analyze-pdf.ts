import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCompanyIdFromUser } from '../../server/auth/companyContext.js';
import { canAnalyzeDocuments } from '../../server/auth/permissions.js';
import { requireAuth } from '../../server/auth/requireAuth.js';
import { analyzePdfBuffer } from '../../server/ai/services/analyzePdfService.js';
import { AI_ERROR_MESSAGES } from '../../server/ai/constants.js';
import { isAiAnalysisError } from '../../server/ai/utils/errors.js';
import { parseMultipart } from '../../server/utils/parseMultipart.js';
import { extractRequestContext, getBearerAuthLogFields } from '../../server/utils/requestContext.js';
import { logger } from '../../server/utils/logger.js';
import {
  getStorageConfig,
  isLocalStorageEnabled,
} from '../../server/storage/storageConfig.js';
import { storeAnalysisStaging } from '../../server/storage/index.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';
import { workflowErrorFromUnknown } from '../../server/utils/workflowErrors.js';

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const ctx = extractRequestContext(req);
  const startedAt = Date.now();

  logger.info('analyze-pdf request started', {
    requestId: ctx.requestId,
    batchId: ctx.batchId,
    itemId: ctx.itemId,
    fileName: ctx.fileName,
    endpoint: '/api/ai/analyze-pdf',
    ...getBearerAuthLogFields(req),
  });

  const user = await requireAuth(req, res);
  if (!user) return;

  if (!canAnalyzeDocuments(user)) {
    logger.warn('analyze-pdf forbidden', {
      requestId: ctx.requestId,
      userId: user.id,
      durationMs: Date.now() - startedAt,
    });
    return res.status(403).json({ message: 'Sem permissão para analisar documentos.' });
  }

  try {
    const { file } = await parseMultipart(req);

    if (!file) {
      logger.warn('analyze-pdf validation failed', {
        requestId: ctx.requestId,
        reason: 'missing_file',
        durationMs: Date.now() - startedAt,
      });
      return res.status(400).json({ message: AI_ERROR_MESSAGES.pdfOnly });
    }

    if (file.size === 0) {
      logger.warn('analyze-pdf validation failed', {
        requestId: ctx.requestId,
        reason: 'empty_file',
        durationMs: Date.now() - startedAt,
      });
      return res.status(400).json({ message: AI_ERROR_MESSAGES.emptyFile });
    }

    if (isLocalStorageEnabled()) {
      const storageConfig = getStorageConfig();
      if (file.size > storageConfig.maxUploadBytes) {
        logger.warn('analyze-pdf validation failed', {
          requestId: ctx.requestId,
          reason: 'file_too_large',
          fileSizeBytes: file.size,
          maxUploadBytes: storageConfig.maxUploadBytes,
          durationMs: Date.now() - startedAt,
        });
        return res.status(413).json({
          message: `Arquivo excede o limite de ${Math.floor(storageConfig.maxUploadBytes / (1024 * 1024))} MB.`,
          code: 'FILE_TOO_LARGE',
        });
      }
    }

    const companyId = getCompanyIdFromUser(user);

    const result = await analyzePdfBuffer({
      buffer: file.buffer,
      originalFileName: file.filename,
      mimeType: file.mimeType,
      companyId,
      ownerUserId: user.id,
      requestContext: {
        requestId: ctx.requestId,
        batchId: ctx.batchId,
        itemId: ctx.itemId,
        fileName: file.filename,
      },
    });

    if (isLocalStorageEnabled()) {
      try {
        await storeAnalysisStaging({
          tenantId: companyId,
          ownerUserId: user.id,
          jobId: result.jobId,
          buffer: file.buffer,
          mimeType: file.mimeType,
          originalFileName: file.filename,
        });
      } catch (stagingError) {
        if (isServiceError(stagingError)) {
          logger.warn('analyze-pdf staging failed', {
            requestId: ctx.requestId,
            code: stagingError.code,
            message: stagingError.message,
            durationMs: Date.now() - startedAt,
          });
          const { statusCode, body } = workflowErrorFromUnknown(stagingError, {
            requestId: ctx.requestId,
            defaultCode: stagingError.code,
          });
          return res.status(statusCode).json(body);
        }
        throw stagingError;
      }
    }

    logger.info('analyze-pdf request completed', {
      requestId: ctx.requestId,
      batchId: ctx.batchId,
      itemId: ctx.itemId,
      fileName: file.filename,
      fileSizeBytes: file.size,
      mimeType: file.mimeType,
      aiMode: process.env.AI_MODE?.trim() || 'groq',
      jobId: result.jobId,
      status: result.status,
      className: result.classification.className,
      classId: result.classification.classId,
      confidence: result.classification.confidence,
      requiresReview: result.classification.requiresReview,
      textCharCount: result.textExtraction.charCount,
      pageCount: result.textExtraction.pageCount,
      durationMs: Date.now() - startedAt,
    });

    res.setHeader('X-DOQYN-Request-Id', ctx.requestId);
    return res.status(200).json(result);
  } catch (error) {
    if (isAiAnalysisError(error)) {
      logger.warn('analyze-pdf controlled error', {
        requestId: ctx.requestId,
        code: error.code,
        message: error.message,
        durationMs: Date.now() - startedAt,
      });
      const { statusCode, body } = workflowErrorFromUnknown(error, {
        requestId: ctx.requestId,
      });
      res.setHeader('X-DOQYN-Request-Id', ctx.requestId);
      return res.status(statusCode).json(body);
    }

    logger.error('analyze-pdf unexpected error', {
      requestId: ctx.requestId,
      message: error instanceof Error ? error.message : 'unknown',
      durationMs: Date.now() - startedAt,
    });
    return res.status(500).json({ message: AI_ERROR_MESSAGES.analysisFailed });
  }
}
