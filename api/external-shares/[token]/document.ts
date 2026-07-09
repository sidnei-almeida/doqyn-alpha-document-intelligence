import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  buildExternalShareAuditContext,
  buildExternalShareTrackingMetadata,
  resolveExternalShareAccess,
} from '../../../server/services/sharing/externalDocumentShareService.js';
import { getExternalShareDocumentDetail } from '../../../server/services/sharing/externalDocumentSharePreviewService.js';
import { emitTrackingEvent } from '../../../server/services/tracking/trackingService.js';
import { isServiceError } from '../../../server/utils/serviceErrors.js';
import { sanitizeAuditMetadata } from '../../../server/utils/sanitizeAuditMetadata.js';

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
    const detail = await getExternalShareDocumentDetail(token);
    const access = await resolveExternalShareAccess(token);
    if (access.grant) {
      const auditCtx = buildExternalShareAuditContext(access.grant);
      await emitTrackingEvent(
        auditCtx,
        {
          action: 'document.external_share_viewed',
          description: 'Documento compartilhado externamente visualizado.',
          documentId: access.grant.documentId,
          versionId: detail.versionId,
          metadata: sanitizeAuditMetadata(
            buildExternalShareTrackingMetadata(access.grant, { source: 'guest_portal' }),
          ),
          security: { isExternalGuest: true, authMethod: 'external_share_token' },
        },
        req,
      );
    }
    return res.status(200).json(detail);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
