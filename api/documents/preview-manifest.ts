import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDocumentAuditContext } from '../../server/audit/buildDocumentAuditContext.js';
import { createDocumentAuditLog } from '../../server/audit/documentAuditLogService.js';
import { buildDocumentNameSnapshot } from '../../server/audit/documentNameSnapshot.js';
import { getDocumentPreviewManifest } from '../../server/services/documentPreviewManifestService.js';
import { requireDocumentAuthContext } from '../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';
import { sanitizeAuditMetadata } from '../../server/utils/sanitizeAuditMetadata.js';
import { setPreviewManifestCacheHeaders } from '../../server/utils/previewCacheHeaders.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const documentId =
    typeof req.query.documentId === 'string' ? req.query.documentId : undefined;
  const versionId = typeof req.query.versionId === 'string' ? req.query.versionId : undefined;
  const trackView = req.query.trackView !== 'false';

  if (!documentId || !versionId) {
    return res.status(400).json({
      message: 'documentId e versionId são obrigatórios.',
      code: 'MISSING_PREVIEW_PARAMS',
    });
  }

  try {
    const manifest = await getDocumentPreviewManifest({
      tenantId: auth.ctx.tenantId,
      ownerUserId: auth.ctx.userId,
      documentId,
      versionId,
      user: auth.user,
      membershipId: auth.ctx.membershipId,
      storageScope: auth.ctx.storageScope,
    });

    if (trackView && manifest.status === 'ready') {
      const auditCtx = buildDocumentAuditContext(auth.ctx, auth.user);
      const documentNameSnapshot = buildDocumentNameSnapshot({
        finalFileName: manifest.fileName,
      });

      await createDocumentAuditLog(auditCtx, {
        action: 'document.preview_viewed',
        description: 'Preview do documento visualizado.',
        documentId,
        versionId,
        target: {
          type: 'document',
          id: documentId,
          nameSnapshot: documentNameSnapshot,
        },
        metadata: sanitizeAuditMetadata({
          documentName: documentNameSnapshot,
          viewerType: manifest.viewerType,
          source: 'manifest',
        }),
      }).catch(() => undefined);
    }

    setPreviewManifestCacheHeaders(res, {
      documentId,
      versionId,
      status: manifest.status,
    });
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).json(manifest);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
