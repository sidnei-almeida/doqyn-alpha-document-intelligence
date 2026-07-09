import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getExternalSharePortalPayload,
  buildExternalShareAuditContext,
  buildExternalShareTrackingMetadata,
  resolveExternalShareAccess,
} from '../../server/services/sharing/externalDocumentShareService.js';
import { emitTrackingEvent } from '../../server/services/tracking/trackingService.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';
import { sanitizeAuditMetadata } from '../../server/utils/sanitizeAuditMetadata.js';

function resolveToken(req: VercelRequest): string | undefined {
  const fromQuery = req.query.token;
  if (typeof fromQuery === 'string' && fromQuery.trim()) return fromQuery.trim();
  return undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const token = resolveToken(req);
  if (!token) {
    return res.status(400).json({ message: 'token é obrigatório.', code: 'MISSING_SHARE_TOKEN' });
  }

  try {
    const access = await resolveExternalShareAccess(token);
    if (access.grant) {
      const auditCtx = buildExternalShareAuditContext(access.grant);
      await emitTrackingEvent(
        auditCtx,
        {
          action: 'document.external_share_invite_opened',
          description: 'Convite de compartilhamento externo aberto.',
          documentId: access.grant.documentId,
          metadata: sanitizeAuditMetadata(
            buildExternalShareTrackingMetadata(access.grant, {
              source: 'guest_portal',
              inviteStatus: access.grant.status,
            }),
          ),
        },
        req,
      );
    }

    const payload = await getExternalSharePortalPayload(token);
    return res.status(200).json(payload);
  } catch (error) {
    if (isServiceError(error)) {
      const access = await resolveExternalShareAccess(token);
      if (access.grant) {
        const auditCtx = buildExternalShareAuditContext(access.grant);
        await emitTrackingEvent(
          auditCtx,
          {
            action: 'document.external_share_denied',
            description: 'Acesso externo negado.',
            documentId: access.grant.documentId,
            status: 'denied',
            metadata: sanitizeAuditMetadata(
              buildExternalShareTrackingMetadata(access.grant, {
                reason: error.code,
                source: 'guest_portal',
              }),
            ),
          },
          req,
        );
      }
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
