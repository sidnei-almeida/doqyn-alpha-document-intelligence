import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDocumentAuditContext } from '../../../../server/audit/buildDocumentAuditContext.js';
import { revokeDocumentShareGrant } from '../../../../server/services/sharing/documentShareService.js';
import { emitTrackingEvent } from '../../../../server/services/tracking/trackingService.js';
import { requireDocumentAuthContext } from '../../../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../../../server/utils/serviceErrors.js';
import { sanitizeAuditMetadata } from '../../../../server/utils/sanitizeAuditMetadata.js';

function resolveParam(req: VercelRequest, key: string): string | undefined {
  const value = req.query[key];
  if (typeof value === 'string' && value.trim()) return value.trim();
  return undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const documentId = resolveParam(req, 'documentId');
  const shareId = resolveParam(req, 'shareId');

  if (!documentId || !shareId) {
    return res.status(400).json({
      message: 'documentId e shareId são obrigatórios.',
      code: 'MISSING_PARAMS',
    });
  }

  const auditCtx = buildDocumentAuditContext(auth.ctx, auth.user);

  try {
    const result = await revokeDocumentShareGrant(auth.ctx, auth.user, documentId, shareId);

    await emitTrackingEvent(
      auditCtx,
      {
        action: 'document.share_revoked',
        description: 'Compartilhamento revogado.',
        documentId,
        versionId: result.currentVersionId,
        metadata: sanitizeAuditMetadata({
          source: 'api',
          shareId: result.shareId,
          sharedWithUserId: result.sharedWithUserId,
        }),
      },
      req,
    );

    return res.status(200).json(result);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
