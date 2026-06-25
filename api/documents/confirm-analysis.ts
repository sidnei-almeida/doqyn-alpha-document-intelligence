import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCompanyIdFromUser } from '../../server/auth/companyContext.js';
import { requireAuth } from '../../server/auth/requireAuth.js';
import {
  confirmAnalysisPersistence,
  confirmAnalysisSchema,
  isConfirmAnalysisError,
} from '../../server/services/confirmAnalysisService.js';
import { isMongoNativeConfigured } from '../../server/db/mongoClient.js';
import { extractRequestContext, getBearerAuthLogFields } from '../../server/utils/requestContext.js';
import { logger } from '../../server/utils/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const ctx = extractRequestContext(req);
  const startedAt = Date.now();

  logger.info('confirm-analysis request started', {
    requestId: ctx.requestId,
    batchId: ctx.batchId,
    itemId: ctx.itemId,
    fileName: ctx.fileName,
    endpoint: '/api/documents/confirm-analysis',
    ...getBearerAuthLogFields(req),
  });

  if (!isMongoNativeConfigured()) {
    logger.warn('confirm-analysis unavailable', {
      requestId: ctx.requestId,
      reason: 'mongodb_not_configured',
      durationMs: Date.now() - startedAt,
    });
    return res.status(503).json({
      message: 'Persistência indisponível. Configure MONGODB_URI no servidor.',
      code: 'MONGODB_NOT_CONFIGURED',
    });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    const body = req.body;
    const parsed = confirmAnalysisSchema.safeParse(body);

    if (!parsed.success) {
      logger.warn('confirm-analysis invalid payload', {
        requestId: ctx.requestId,
        durationMs: Date.now() - startedAt,
      });
      return res.status(400).json({
        message: 'Payload inválido para confirmação de metadados.',
        code: 'INVALID_PAYLOAD',
      });
    }

    const companyId = getCompanyIdFromUser(user);

    const result = await confirmAnalysisPersistence({
      payload: parsed.data,
      user,
      companyId,
      requestId: ctx.requestId,
    });

    logger.info('confirm-analysis request completed', {
      requestId: ctx.requestId,
      batchId: ctx.batchId,
      itemId: ctx.itemId,
      fileName: parsed.data.originalFileName,
      documentId: result.documentId,
      versionId: result.versionId,
      durationMs: Date.now() - startedAt,
    });

    res.setHeader('X-DOQYN-Request-Id', ctx.requestId);
    return res.status(201).json(result);
  } catch (error) {
    if (isConfirmAnalysisError(error)) {
      logger.warn('confirm-analysis controlled error', {
        requestId: ctx.requestId,
        code: error.code,
        message: error.message,
        durationMs: Date.now() - startedAt,
      });
      return res.status(error.statusCode).json({
        message: error.message,
        code: error.code,
        status: error.code === 'REQUIRES_REVIEW' ? 'requires_review' : 'error',
      });
    }

    logger.error('confirm-analysis unexpected error', {
      requestId: ctx.requestId,
      message: error instanceof Error ? error.message : 'unknown',
      durationMs: Date.now() - startedAt,
    });
    return res.status(500).json({
      message: 'Não foi possível salvar o documento. Tente novamente.',
      code: 'PERSISTENCE_FAILED',
    });
  }
}
