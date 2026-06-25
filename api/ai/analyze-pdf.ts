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

    const companyId = getCompanyIdFromUser(user);

    const result = await analyzePdfBuffer({
      buffer: file.buffer,
      originalFileName: file.filename,
      mimeType: file.mimeType,
      companyId,
      requestContext: {
        requestId: ctx.requestId,
        batchId: ctx.batchId,
        itemId: ctx.itemId,
        fileName: file.filename,
      },
    });

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
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }

    logger.error('analyze-pdf unexpected error', {
      requestId: ctx.requestId,
      message: error instanceof Error ? error.message : 'unknown',
      durationMs: Date.now() - startedAt,
    });
    return res.status(500).json({ message: AI_ERROR_MESSAGES.analysisFailed });
  }
}
