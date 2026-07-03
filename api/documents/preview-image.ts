import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readDocumentPreviewImageAsset } from '../../server/services/documentPreviewManifestService.js';
import { requireDocumentAuthContext } from '../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const documentId =
    typeof req.query.documentId === 'string' ? req.query.documentId : undefined;
  const versionId = typeof req.query.versionId === 'string' ? req.query.versionId : undefined;
  const size = typeof req.query.size === 'string' ? req.query.size : undefined;

  if (!documentId || !versionId) {
    return res.status(400).json({
      message: 'documentId e versionId são obrigatórios.',
      code: 'MISSING_PREVIEW_IMAGE_PARAMS',
    });
  }

  try {
    const file = await readDocumentPreviewImageAsset({
      tenantId: auth.ctx.tenantId,
      ownerUserId: auth.ctx.userId,
      documentId,
      versionId,
      user: auth.user,
      membershipId: auth.ctx.membershipId,
      storageScope: auth.ctx.storageScope,
      size,
    });

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', String(file.buffer.length));
    res.setHeader('Content-Disposition', `inline; filename="${file.fileName.replace(/"/g, '')}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    return res.status(200).send(file.buffer);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
