import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listPendingDocumentUploadApprovals } from '../../../server/services/documentUploadApprovalService.js';
import { isMongoNativeConfigured } from '../../../server/db/mongoClient.js';
import { buildDocumentRequestContext } from '../../../server/tenancy/documentRequestContext.js';
import { requireAuth } from '../../../server/auth/requireAuth.js';
import { isServiceError } from '../../../server/utils/serviceErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  if (!isMongoNativeConfigured()) {
    return res.status(503).json({
      message: 'Persistência indisponível.',
      code: 'MONGODB_NOT_CONFIGURED',
    });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    const docCtx = await buildDocumentRequestContext(user);
    const approvals = await listPendingDocumentUploadApprovals({
      tenantId: docCtx.tenantId,
      user,
    });

    return res.status(200).json({
      approvals: approvals.map((approval) => ({
        id: approval._id,
        status: approval.status,
        submittedBy: approval.submittedBy,
        originalFileName: approval.originalFileName,
        classId: approval.classId,
        className: approval.className,
        fileHash: approval.fileHash,
        jobId: approval.jobId,
        payload: approval.payload,
        createdAt: approval.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
