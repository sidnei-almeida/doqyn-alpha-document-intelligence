import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  acceptInboundShare,
  declineInboundShare,
} from '../../../server/services/sharing/inboundShareService.js';
import { requireDocumentAuthContext } from '../../../server/tenancy/documentRequestContext.js';
import { buildDocumentAuditContext } from '../../../server/audit/buildDocumentAuditContext.js';
import { emitTrackingEvent } from '../../../server/services/tracking/trackingService.js';
import { sanitizeAuditMetadata } from '../../../server/utils/sanitizeAuditMetadata.js';
import { isServiceError } from '../../../server/utils/serviceErrors.js';

function resolveRecipientName(user: {
  firstName?: string;
  lastName?: string;
  name?: string;
  email: string;
}): string {
  const parts = [user.firstName, user.lastName].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return user.name?.trim() || user.email;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const grantId = typeof req.query.grantId === 'string' ? req.query.grantId : '';
  const decision = (req.body as { decision?: string } | undefined)?.decision;

  if (decision !== 'accept' && decision !== 'decline') {
    return res.status(400).json({
      message: 'Decisão inválida. Use "accept" ou "decline".',
      code: 'INBOUND_SHARE_DECISION_INVALID',
    });
  }

  try {
    const recipientName = resolveRecipientName(auth.user);
    const item =
      decision === 'accept'
        ? await acceptInboundShare(auth.ctx.tenantId, auth.user, grantId, recipientName)
        : await declineInboundShare(auth.ctx.tenantId, auth.user, grantId, recipientName);

    await emitTrackingEvent(
      buildDocumentAuditContext(auth.ctx, auth.user),
      {
        action: decision === 'accept' ? 'inbound_share.accepted' : 'inbound_share.declined',
        params: { documentName: item.documentName, originTenantName: item.originTenantName },
        documentId: item.documentId,
        metadata: sanitizeAuditMetadata({
          grantId: item.grantId,
          originTenantName: item.originTenantName,
        }),
      },
      req,
    );

    return res.status(200).json({ item });
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
