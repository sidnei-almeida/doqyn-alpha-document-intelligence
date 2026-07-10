import type { VercelRequest, VercelResponse } from '@vercel/node';
import { rejectDocumentUploadApproval } from '../../../../server/services/documentUploadApprovalService.js';
import { isMongoNativeConfigured } from '../../../../server/db/mongoClient.js';
import { requireDocumentAuthContext } from '../../../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../../../server/utils/serviceErrors.js';

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

  const body = (req.body ?? {}) as { reason?: string };

  try {
    const result = await rejectDocumentUploadApproval({
      approvalId,
      user: auth.user,
      ctx: auth.ctx,
      reason: body.reason,
    });

    return res.status(200).json(result);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
