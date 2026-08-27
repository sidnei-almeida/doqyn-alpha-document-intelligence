import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  decideApprovalRequest,
  getApprovalRequestById,
  reopenApprovalRequest,
} from '../../../server/services/approvals/approvalRequestService.js';
import { createShareGrantFromApprovedRequest } from '../../../server/services/sharing/documentShareService.js';
import {
  approveDocumentUploadApproval,
  rejectDocumentUploadApproval,
} from '../../../server/services/documentUploadApprovalService.js';
import { requireDocumentAuthContext } from '../../../server/tenancy/documentRequestContext.js';
import { buildDocumentAuditContext } from '../../../server/audit/buildDocumentAuditContext.js';
import { emitTrackingEvent } from '../../../server/services/tracking/trackingService.js';
import { notifyApprovalDecided } from '../../../server/services/notifications/approvalNotifications.js';
import { isServiceError } from '../../../server/utils/serviceErrors.js';
import { logger } from '../../../server/utils/logger.js';
import { sanitizeAuditMetadata } from '../../../server/utils/sanitizeAuditMetadata.js';

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

    /**
     * O efeito antes do aviso.
     *
     * A decisão é gravada primeiro para que dois administradores não disparem o efeito duas vezes
     * — mas então uma falha aqui deixaria um pedido aprovado que não aconteceu. Devolver à fila é
     * a compensação: melhor o administrador tentar de novo do que quem pediu ser avisado de um
     * compartilhamento que não existe.
     */
    const auditCtx = buildDocumentAuditContext(auth.ctx, auth.user);

    if (decided.status === 'approved' && decided.kind === 'document_share') {
      let share;
      try {
        share = await createShareGrantFromApprovedRequest(auth.ctx, decided);
      } catch (error) {
        /**
         * A compensação não pode falar mais alto que a falha que a causou.
         *
         * Reabrir devolve o pedido a `pending`, e ele volta a cair sob o índice único parcial: se
         * o solicitante abriu um pedido novo para o mesmo destinatário nesse intervalo, o E11000
         * estouraria aqui dentro e substituiria o erro real (um `SHARE_RECIPIENT_INVALID`, por
         * exemplo) por um 500 sem explicação.
         */
        await reopenApprovalRequest(auth.ctx.tenantId, requestId).catch((reopenError) => {
          logger.warn('falha ao devolver pedido à fila', {
            requestId,
            error: reopenError instanceof Error ? reopenError.message : String(reopenError),
          });
        });
        throw error;
      }

      // A trilha do compartilhamento é a mesma de `POST /api/documents/:id/shares`: o fato é a
      // concessão, e ela não pode existir só como "pedido aprovado" na auditoria. Fora do `try`
      // de propósito — falha de trilha não desfaz um compartilhamento que já aconteceu.
      await emitTrackingEvent(
        auditCtx,
        {
          action: 'document.share_created',
          description: 'Documento compartilhado após aprovação.',
          documentId: share.documentId,
          versionId: share.currentVersionId,
          metadata: sanitizeAuditMetadata({
            source: 'approval',
            requestId: decided._id,
            sharedWithUserId: share.sharedWithUserId,
            permissions: share.permissions,
          }),
        },
        req,
      );
    }

    await notifyApprovalDecided(decided, auth.user.name);

    await emitTrackingEvent(
      auditCtx,
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
