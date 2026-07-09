import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDocumentAuditContext } from '../../server/audit/buildDocumentAuditContext.js';
import { buildDocumentNameSnapshot } from '../../server/audit/documentNameSnapshot.js';
import { readDocumentVersionFile } from '../../server/services/documentFileService.js';
import {
  emitAccessDeniedEvent,
  emitTrackingEvent,
  extractServiceErrorInfo,
  shouldEmitAccessDeniedFromError,
} from '../../server/services/tracking/trackingService.js';
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
  const disposition = typeof req.query.disposition === 'string' ? req.query.disposition : 'attachment';

  if (!documentId) {
    return res.status(400).json({ message: 'documentId é obrigatório.', code: 'MISSING_DOCUMENT_ID' });
  }

  const auditCtx = buildDocumentAuditContext(auth.ctx, auth.user);

  await emitTrackingEvent(
    auditCtx,
    {
      action: 'document.download_attempted',
      description: 'Tentativa de download do documento.',
      documentId,
      versionId,
      metadata: sanitizeAuditMetadata({ disposition, source: 'api' }),
    },
    req,
  );

  try {
    const file = await readDocumentVersionFile({
      tenantId: auth.ctx.tenantId,
      ownerUserId: auth.ctx.userId,
      documentId,
      versionId,
      storageScope: auth.ctx.storageScope,
      user: auth.user,
      membershipId: auth.ctx.membershipId,
    });

    const documentNameSnapshot = buildDocumentNameSnapshot({
      finalFileName: file.fileName,
      currentFileName: file.fileName,
    });

    await emitTrackingEvent(
      auditCtx,
      {
        action: 'document.downloaded',
        description: 'Download do documento realizado.',
        documentId,
        versionId,
        target: {
          type: 'document',
          id: documentId,
          nameSnapshot: documentNameSnapshot,
        },
        metadata: sanitizeAuditMetadata({
          documentName: documentNameSnapshot,
          mimeType: file.mimeType,
          sizeBytes: file.buffer.length,
          disposition,
          source: 'api',
        }),
      },
      req,
    );

    const safeName = file.fileName.replace(/[^\w.\- ()áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/g, '_');
    const contentDisposition =
      disposition === 'inline'
        ? `inline; filename="${safeName}"`
        : `attachment; filename="${safeName}"`;

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', String(file.buffer.length));
    res.setHeader('Content-Disposition', contentDisposition);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    return res.status(200).send(file.buffer);
  } catch (error) {
    if (shouldEmitAccessDeniedFromError(error)) {
      const info = extractServiceErrorInfo(error);
      await emitAccessDeniedEvent(auditCtx, req, {
        action: 'document.download_denied',
        documentId,
        versionId,
        reason: info.message,
        code: info.code,
        requiredPermission: 'canDownload',
      });
    }
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
