import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDocumentAuditContext } from '../../server/audit/buildDocumentAuditContext.js';
import { createDocumentAuditLog } from '../../server/audit/documentAuditLogService.js';
import { buildDocumentNameSnapshot } from '../../server/audit/documentNameSnapshot.js';
import { readDocumentPreviewFile } from '../../server/services/documentPreviewService.js';
import { requireDocumentAuthContext } from '../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';
import { sanitizeAuditMetadata } from '../../server/utils/sanitizeAuditMetadata.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const documentId = typeof req.query.documentId === 'string' ? req.query.documentId : undefined;
  const versionId = typeof req.query.versionId === 'string' ? req.query.versionId : undefined;
  const trackView = req.query.trackView !== 'false';

  if (!documentId) {
    return res.status(400).json({ message: 'documentId é obrigatório.', code: 'MISSING_DOCUMENT_ID' });
  }

  try {
    const file = await readDocumentPreviewFile({
      tenantId: auth.ctx.tenantId,
      ownerUserId: auth.ctx.userId,
      documentId,
      versionId,
      storageScope: auth.ctx.storageScope,
      user: auth.user,
      membershipId: auth.ctx.membershipId,
    });

    if (trackView) {
      const auditCtx = buildDocumentAuditContext(auth.ctx, auth.user);
      const documentNameSnapshot = buildDocumentNameSnapshot({
        finalFileName: file.fileName,
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
          previewStorageFileName: file.fileName,
          source: 'ui',
        }),
      }).catch(() => undefined);
    }

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', String(file.buffer.length));
    res.setHeader('Content-Disposition', `inline; filename="${file.fileName.replace(/"/g, '')}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    return res.status(200).send(file.buffer);
  } catch (error) {
    if (isServiceError(error)) {
      const auditCtx = buildDocumentAuditContext(auth.ctx, auth.user);
      if (error.code !== 'DOCUMENT_NOT_FOUND' && error.code !== 'DOCUMENT_ACCESS_DENIED') {
        const previewFailedName = buildDocumentNameSnapshot({});
        await createDocumentAuditLog(auditCtx, {
          action: 'document.preview_failed',
          description: 'Falha ao servir preview do documento.',
          documentId,
          versionId,
          result: 'error',
          target: {
            type: 'document',
            id: documentId,
            nameSnapshot: previewFailedName,
          },
          metadata: sanitizeAuditMetadata({
            documentName: previewFailedName,
            reason: error.message,
            code: error.code,
            source: 'api',
          }),
        }).catch(() => undefined);
      }
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
