import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  confirmAnalysisPersistence,
  confirmAnalysisSchema,
  isConfirmAnalysisError,
} from '../../server/services/confirmAnalysisService.js';
import { isMongoNativeConfigured } from '../../server/db/mongoClient.js';
import { buildDocumentRequestContext } from '../../server/tenancy/documentRequestContext.js';
import { requireAuth } from '../../server/auth/requireAuth.js';
import { extractRequestContext, getBearerAuthLogFields } from '../../server/utils/requestContext.js';
import { logger } from '../../server/utils/logger.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';
import { sendWorkflowError } from '../../server/utils/workflowErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const reqCtx = extractRequestContext(req);
  const startedAt = Date.now();

  logger.info('confirm-analysis request started', {
    requestId: reqCtx.requestId,
    batchId: reqCtx.batchId,
    itemId: reqCtx.itemId,
    fileName: reqCtx.fileName,
    endpoint: '/api/documents/confirm-analysis',
    ...getBearerAuthLogFields(req),
  });

  if (!isMongoNativeConfigured()) {
    logger.warn('confirm-analysis unavailable', {
      requestId: reqCtx.requestId,
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
      const issues = parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        code: issue.code,
        message: issue.message,
      }));
      logger.warn('confirm-analysis invalid payload', {
        requestId: reqCtx.requestId,
        issues,
        durationMs: Date.now() - startedAt,
      });
      return res.status(400).json({
        message: 'Payload inválido para confirmação de metadados.',
        code: 'INVALID_PAYLOAD',
        issues,
      });
    }

    const docCtx = await buildDocumentRequestContext(user);

    const result = await confirmAnalysisPersistence({
      payload: parsed.data,
      user,
      ctx: docCtx,
      requestId: reqCtx.requestId,
    });

    logger.info('confirm-analysis request completed', {
      requestId: reqCtx.requestId,
      batchId: reqCtx.batchId,
      itemId: reqCtx.itemId,
      fileName: parsed.data.originalFileName,
      documentId: result.documentId,
      versionId: result.versionId,
      durationMs: Date.now() - startedAt,
    });

    res.setHeader('X-DOQYN-Request-Id', reqCtx.requestId);
    return res.status(201).json(result);
  } catch (error) {
    if (isServiceError(error)) {
      logger.warn('confirm-analysis controlled error', {
        requestId: reqCtx.requestId,
        code: error.code,
        message: error.message,
        durationMs: Date.now() - startedAt,
      });
      return res.status(error.statusCode).json({
        message: error.message,
        code: error.code,
      });
    }

    if (isConfirmAnalysisError(error)) {
      logger.warn('confirm-analysis controlled error', {
        requestId: reqCtx.requestId,
        code: error.code,
        message: error.message,
        durationMs: Date.now() - startedAt,
      });
      if (error.code === 'CLASS_OR_RULE_NOT_FOUND') {
        sendWorkflowError(res, error.statusCode, {
          code: error.code,
          message: error.message,
          technicalDetail: error.message,
          requestId: reqCtx.requestId,
        });
        return;
      }
      return res.status(error.statusCode).json({
        message: error.message,
        code: error.code,
        status: error.code === 'REQUIRES_REVIEW' ? 'requires_review' : 'error',
      });
    }

    logger.error('confirm-analysis unexpected error', {
      requestId: reqCtx.requestId,
      message: error instanceof Error ? error.message : 'unknown',
      durationMs: Date.now() - startedAt,
    });
    return res.status(500).json({
      message: 'Não foi possível salvar o documento. Tente novamente.',
      code: 'PERSISTENCE_FAILED',
    });
  }
}
