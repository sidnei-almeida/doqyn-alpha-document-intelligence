import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  decideApprovalRequest,
  getApprovalRequestById,
} from '../../../server/services/approvals/approvalRequestService.js';
import {
  approveDocumentUploadApproval,
  rejectDocumentUploadApproval,
} from '../../../server/services/documentUploadApprovalService.js';
import { requireDocumentAuthContext } from '../../../server/tenancy/documentRequestContext.js';
import { buildDocumentAuditContext } from '../../../server/audit/buildDocumentAuditContext.js';
import { emitTrackingEvent } from '../../../server/services/tracking/trackingService.js';
import { notifyApprovalDecided } from '../../../server/services/notifications/approvalNotifications.js';
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
    // Enquanto o fluxo de upload grava no formato antigo, a fila mistura as duas coleções. O
    // cliente decide por um endpoint só; quem sabe qual serviço executa o efeito é o servidor.
    const known = await getApprovalRequestById(auth.ctx.tenantId, requestId);
    if (!known) {
      if (body.decision === 'approved') {
        const result = await approveDocumentUploadApproval({
          approvalId: requestId,
          user: auth.user,
          ctx: auth.ctx,
        });
        return res.status(200).json({ legacyUploadApproval: result });
      }

      const result = await rejectDocumentUploadApproval({
        approvalId: requestId,
        user: auth.user,
        ctx: auth.ctx,
        reason: body.reason,
      });
      return res.status(200).json({ legacyUploadApproval: result });
    }

    const decided = await decideApprovalRequest({
      tenantId: auth.ctx.tenantId,
      requestId,
      decidedByUserId: auth.ctx.userId,
      decision: body.decision,
      reason: body.reason,
    });

    await notifyApprovalDecided(decided, auth.user.name);

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
