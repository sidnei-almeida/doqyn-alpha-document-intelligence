import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readDocumentPreviewPageImage } from '../../server/services/documentPreviewManifestService.js';
import { requireDocumentAuthContext } from '../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';
import { setPreviewAssetCacheHeaders } from '../../server/utils/previewCacheHeaders.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const documentId =
    typeof req.query.documentId === 'string' ? req.query.documentId : undefined;
  const versionId = typeof req.query.versionId === 'string' ? req.query.versionId : undefined;
  const pageRaw = typeof req.query.page === 'string' ? req.query.page : undefined;
  const pageNumber = pageRaw ? Number.parseInt(pageRaw, 10) : NaN;

  if (!documentId || !versionId || !Number.isFinite(pageNumber) || pageNumber < 1) {
    return res.status(400).json({
      message: 'documentId, versionId e page são obrigatórios.',
      code: 'MISSING_PREVIEW_PAGE_PARAMS',
    });
  }

  try {
    const file = await readDocumentPreviewPageImage({
      tenantId: auth.ctx.tenantId,
      ownerUserId: auth.ctx.userId,
      documentId,
      versionId,
      pageNumber,
      user: auth.user,
      membershipId: auth.ctx.membershipId,
      storageScope: auth.ctx.storageScope,
      thumbnail: true,
    });

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', String(file.buffer.length));
    res.setHeader('Content-Disposition', `inline; filename="thumb-${pageNumber}.png"`);
    setPreviewAssetCacheHeaders(
      res,
      `"${documentId}:${versionId}:thumb:${pageNumber}"`,
      { immutable: true },
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');

    return res.status(200).send(file.buffer);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
