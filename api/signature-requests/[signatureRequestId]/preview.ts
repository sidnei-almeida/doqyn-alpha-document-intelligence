import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDocumentAuditContext } from '../../../server/audit/buildDocumentAuditContext.js';
import {
  getInternalSignaturePreviewManifest,
  readInternalSignaturePreviewImageAsset,
  readInternalSignaturePreviewPageImage,
} from '../../../server/services/signatures/documentSignaturePreviewService.js';
import { emitTrackingEvent } from '../../../server/services/tracking/trackingService.js';
import { requireDocumentAuthContext } from '../../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../../server/utils/serviceErrors.js';
import { sanitizeAuditMetadata } from '../../../server/utils/sanitizeAuditMetadata.js';
import { setPreviewAssetCacheHeaders, setPreviewManifestCacheHeaders } from '../../../server/utils/previewCacheHeaders.js';

function resolveId(req: VercelRequest): string | undefined {
  const value = req.query.signatureRequestId;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function resolveSubresource(pathname: string, signatureRequestId: string): string | null {
  const prefix = `/api/signature-requests/${encodeURIComponent(signatureRequestId)}/preview`;
  if (!pathname.startsWith(prefix)) return null;
  const rest = pathname.slice(prefix.length);
  return rest || '/manifest';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const signatureRequestId = resolveId(req);
  if (!signatureRequestId) {
    return res.status(400).json({ message: 'signatureRequestId é obrigatório.', code: 'MISSING_ID' });
  }

  const pathname = typeof req.url === 'string' ? new URL(req.url, 'http://localhost').pathname : '';
  const subresource = resolveSubresource(pathname, signatureRequestId) ?? '/manifest';

  try {
    if (subresource === '/manifest' || subresource === '/') {
      const manifest = await getInternalSignaturePreviewManifest(
        auth.ctx,
        auth.user,
        signatureRequestId,
      );
      const auditCtx = buildDocumentAuditContext(auth.ctx, auth.user);
      await emitTrackingEvent(
        auditCtx,
        {
          action: 'document.signature_preview_viewed',
          description: 'Preview do documento para assinatura interna visualizado.',
          documentId: manifest.documentId,
          versionId: manifest.versionId,
          metadata: sanitizeAuditMetadata({
            signatureRequestId,
            signerType: 'internal_user',
            previewStatus: manifest.status,
            source: 'signature_internal',
          }),
          security: { isExternalGuest: false, authMethod: 'logged_in_session' },
        },
        req,
      );
      setPreviewManifestCacheHeaders(res, {
        documentId: manifest.documentId,
        versionId: manifest.versionId,
        status: manifest.status,
      });
      return res.status(200).json(manifest);
    }

    const pageMatch = subresource.match(/^\/pages\/(\d+)$/);
    if (pageMatch) {
      const pageNumber = Number(pageMatch[1]);
      const file = await readInternalSignaturePreviewPageImage({
        ctx: auth.ctx,
        user: auth.user,
        signatureRequestId,
        pageNumber,
        thumbnail: false,
      });
      setPreviewAssetCacheHeaders(res, `"sign-internal:${signatureRequestId}:page:${pageNumber}"`);
      res.setHeader('Content-Type', file.mimeType);
      return res.status(200).send(file.buffer);
    }

    const thumbMatch = subresource.match(/^\/thumbnails\/(\d+)$/);
    if (thumbMatch) {
      const pageNumber = Number(thumbMatch[1]);
      const file = await readInternalSignaturePreviewPageImage({
        ctx: auth.ctx,
        user: auth.user,
        signatureRequestId,
        pageNumber,
        thumbnail: true,
      });
      setPreviewAssetCacheHeaders(res, `"sign-internal:${signatureRequestId}:thumb:${pageNumber}"`);
      res.setHeader('Content-Type', file.mimeType);
      return res.status(200).send(file.buffer);
    }

    if (subresource.startsWith('/image')) {
      const size = typeof req.query.size === 'string' ? req.query.size : undefined;
      const file = await readInternalSignaturePreviewImageAsset({
        ctx: auth.ctx,
        user: auth.user,
        signatureRequestId,
        size,
      });
      setPreviewAssetCacheHeaders(res, `"sign-internal:${signatureRequestId}:image:${size ?? 'medium'}"`);
      res.setHeader('Content-Type', file.mimeType);
      return res.status(200).send(file.buffer);
    }

    return res.status(404).json({ message: 'Recurso de preview não encontrado.', code: 'PREVIEW_NOT_FOUND' });
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
