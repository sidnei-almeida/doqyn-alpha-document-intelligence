import type { VercelRequest, VercelResponse } from '@vercel/node';
import { approveDocumentUploadApproval } from '../../../../server/services/documentUploadApprovalService.js';
import { isMongoNativeConfigured } from '../../../../server/db/mongoClient.js';
import { requireDocumentAuthContext } from '../../../../server/tenancy/documentRequestContext.js';
import { extractRequestContext } from '../../../../server/utils/requestContext.js';
import { isServiceError } from '../../../../server/utils/serviceErrors.js';
import { isConfirmAnalysisError } from '../../../../server/services/confirmAnalysisService.js';

function resolveId(req: VercelRequest): string | undefined {
  const value = req.query.approvalId;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  if (!isMongoNativeConfigured()) {
    return res.status(503).json({
      message: 'Persistência indisponível.',
      code: 'MONGODB_NOT_CONFIGURED',
    });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const approvalId = resolveId(req);
  if (!approvalId) {
    return res.status(400).json({ message: 'approvalId é obrigatório.', code: 'MISSING_ID' });
  }

  const reqCtx = extractRequestContext(req);

  try {
    const result = await approveDocumentUploadApproval({
      approvalId,
      user: auth.user,
      ctx: auth.ctx,
      requestId: reqCtx.requestId,
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
