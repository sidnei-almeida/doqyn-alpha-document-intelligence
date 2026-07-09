import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  confirmUpdateDocumentVersionPersistence,
  confirmUpdateSchema,
  isConfirmAnalysisError,
} from '../../server/services/confirmUpdateDocumentVersionService.js';
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

  logger.info('confirm-update request started', {
    requestId: reqCtx.requestId,
    endpoint: '/api/documents/confirm-update',
    ...getBearerAuthLogFields(req),
  });

  if (!isMongoNativeConfigured()) {
    return res.status(503).json({
      message: 'Persistência indisponível. Configure MONGODB_URI no servidor.',
      code: 'MONGODB_NOT_CONFIGURED',
    });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    const parsed = confirmUpdateSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: 'Payload inválido para atualização de versão.',
        code: 'INVALID_PAYLOAD',
      });
    }

    const docCtx = await buildDocumentRequestContext(user);

    const result = await confirmUpdateDocumentVersionPersistence({
      payload: parsed.data,
      user,
      ctx: docCtx,
      requestId: reqCtx.requestId,
    });

    logger.info('confirm-update request completed', {
      requestId: reqCtx.requestId,
      documentId: result.documentId,
      versionId: result.versionId,
      versionLabel: result.versionLabel,
      durationMs: Date.now() - startedAt,
    });

    res.setHeader('X-DOQYN-Request-Id', reqCtx.requestId);
    return res.status(200).json(result);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({
        message: error.message,
        code: error.code,
      });
    }

    if (isConfirmAnalysisError(error)) {
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

    logger.error('confirm-update unexpected error', {
      requestId: reqCtx.requestId,
      message: error instanceof Error ? error.message : 'unknown',
      durationMs: Date.now() - startedAt,
    });
    return res.status(500).json({
      message: 'Não foi possível atualizar o documento. Tente novamente.',
      code: 'PERSISTENCE_FAILED',
    });
  }
}
