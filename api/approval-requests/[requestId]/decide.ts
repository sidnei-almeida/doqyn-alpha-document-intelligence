import type { VercelRequest, VercelResponse } from '@vercel/node';
import { decideApprovalRequest } from '../../../server/services/approvals/approvalRequestService.js';
import { requireDocumentAuthContext } from '../../../server/tenancy/documentRequestContext.js';
import { buildDocumentAuditContext } from '../../../server/audit/buildDocumentAuditContext.js';
import { emitTrackingEvent } from '../../../server/services/tracking/trackingService.js';
import { isServiceError } from '../../../server/utils/serviceErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const requestId = typeof req.query.requestId === 'string' ? req.query.requestId : '';
  if (!requestId) {
    return res.status(400).json({ message: 'Pedido não informado.', code: 'REQUEST_ID_REQUIRED' });
  }

  const body = (req.body ?? {}) as { decision?: string; reason?: string };
  if (body.decision !== 'approved' && body.decision !== 'rejected') {
    return res
      .status(400)
      .json({ message: 'Decisão inválida.', code: 'APPROVAL_DECISION_INVALID' });
  }

  try {
    const decided = await decideApprovalRequest({
      tenantId: auth.ctx.tenantId,
      requestId,
      decidedByUserId: auth.ctx.userId,
      decision: body.decision,
      reason: body.reason,
    });

    await emitTrackingEvent(
      buildDocumentAuditContext(auth.ctx, auth.user),
      {
        action:
          body.decision === 'approved' ? 'approval.request_approved' : 'approval.request_rejected',
        description: body.decision === 'approved' ? 'Pedido aprovado.' : 'Pedido recusado.',
        documentId: decided.subject.documentId,
        metadata: {
          requestId: decided._id,
          kind: decided.kind,
          requestedByUserId: decided.requestedBy.userId,
        },
      },
      req,
    );

    return res.status(200).json({ request: decided });
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
