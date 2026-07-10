import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  confirmAnalysisSchema,
  isConfirmAnalysisError,
} from '../../server/services/confirmAnalysisService.js';
import { submitDocumentUploadForApproval } from '../../server/services/documentUploadApprovalService.js';
import { isMongoNativeConfigured } from '../../server/db/mongoClient.js';
import { buildDocumentRequestContext } from '../../server/tenancy/documentRequestContext.js';
import { requireAuth } from '../../server/auth/requireAuth.js';
import { extractRequestContext } from '../../server/utils/requestContext.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  if (!isMongoNativeConfigured()) {
    return res.status(503).json({
      message: 'Persistência indisponível. Configure MONGODB_URI no servidor.',
      code: 'MONGODB_NOT_CONFIGURED',
    });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const reqCtx = extractRequestContext(req);

  try {
    const parsed = confirmAnalysisSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Payload inválido para envio de aprovação.',
        code: 'INVALID_PAYLOAD',
      });
    }

    const docCtx = await buildDocumentRequestContext(user);
    const result = await submitDocumentUploadForApproval({
      payload: parsed.data,
      user,
      ctx: docCtx,
    });

    res.setHeader('X-DOQYN-Request-Id', reqCtx.requestId);
    return res.status(201).json(result);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    if (isConfirmAnalysisError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
