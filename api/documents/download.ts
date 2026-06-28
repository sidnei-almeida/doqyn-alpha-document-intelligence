import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readDocumentVersionFile } from '../../server/services/documentFileService.js';
import { requireDocumentRequestContext } from '../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const ctx = await requireDocumentRequestContext(req, res);
  if (!ctx) return;

  const documentId = typeof req.query.documentId === 'string' ? req.query.documentId : undefined;
  const versionId = typeof req.query.versionId === 'string' ? req.query.versionId : undefined;
  const disposition = typeof req.query.disposition === 'string' ? req.query.disposition : 'attachment';

  if (!documentId) {
    return res.status(400).json({ message: 'documentId é obrigatório.', code: 'MISSING_DOCUMENT_ID' });
  }

  try {
    const file = await readDocumentVersionFile({
      tenantId: ctx.tenantId,
      ownerUserId: ctx.userId,
      documentId,
      versionId,
    });

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
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
