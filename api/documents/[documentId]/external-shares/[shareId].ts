import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDocumentAuditContext } from '../../../../server/audit/buildDocumentAuditContext.js';
import {
  revokeDocumentExternalShareGrant,
} from '../../../../server/services/sharing/externalDocumentShareService.js';
import { emitTrackingEvent } from '../../../../server/services/tracking/trackingService.js';
import { requireDocumentAuthContext } from '../../../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../../../server/utils/serviceErrors.js';
import { sanitizeAuditMetadata } from '../../../../server/utils/sanitizeAuditMetadata.js';

function resolveDocumentId(req: VercelRequest): string | undefined {
  const fromQuery = req.query.documentId;
  if (typeof fromQuery === 'string' && fromQuery.trim()) return fromQuery.trim();
  return undefined;
}

function resolveShareId(req: VercelRequest): string | undefined {
  const fromQuery = req.query.shareId;
  if (typeof fromQuery === 'string' && fromQuery.trim()) return fromQuery.trim();
  return undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const documentId = resolveDocumentId(req);
  const shareId = resolveShareId(req);
  if (!documentId || !shareId) {
    return res.status(400).json({
      message: 'documentId e shareId são obrigatórios.',
      code: 'MISSING_SHARE_PARAMS',
    });
  }

  const auditCtx = buildDocumentAuditContext(auth.ctx, auth.user);

  try {
    const result = await revokeDocumentExternalShareGrant(auth.ctx, auth.user, documentId, shareId);

    if (!result.alreadyRevoked) {
      await emitTrackingEvent(
        auditCtx,
        {
          action: 'document.external_share_revoked',
          description: 'Compartilhamento externo revogado.',
          documentId,
          versionId: result.currentVersionId,
          metadata: sanitizeAuditMetadata({
            shareId,
            source: 'api',
          }),
        },
        req,
      );
    }

    return res.status(200).json(result);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
