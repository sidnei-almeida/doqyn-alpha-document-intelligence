import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDocumentAuditContext } from '../../../server/audit/buildDocumentAuditContext.js';
import { renameDocument } from '../../../server/services/documentRenameService.js';
import { emitTrackingEvent } from '../../../server/services/tracking/trackingService.js';
import { requireDocumentAuthContext } from '../../../server/tenancy/documentRequestContext.js';
import { sanitizeAuditMetadata } from '../../../server/utils/sanitizeAuditMetadata.js';
import { isServiceError } from '../../../server/utils/serviceErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH' && req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const documentId = String(req.query.documentId ?? '').trim();
  if (!documentId) {
    return res.status(400).json({ message: 'documentId é obrigatório.', code: 'VALIDATION_ERROR' });
  }

  const body = (req.body ?? {}) as { fileName?: unknown };
  if (typeof body.fileName !== 'string') {
    return res.status(400).json({ message: 'fileName é obrigatório.', code: 'VALIDATION_ERROR' });
  }

  try {
    const result = await renameDocument({
      tenantId: auth.ctx.tenantId,
      documentId,
      fileName: body.fileName,
      user: auth.user,
      userId: auth.ctx.userId,
      membershipId: auth.ctx.membershipId,
    });

    // Só registra quando o nome de fato mudou: salvar o mesmo texto não é um
    // fato da história do documento.
    if (result.fileName !== result.previousFileName) {
      await emitTrackingEvent(
        buildDocumentAuditContext(auth.ctx, auth.user),
        {
          action: 'document.filename_updated',
          description: 'Nome do documento alterado manualmente.',
          documentId,
          versionId: result.versionId,
          target: { type: 'document', id: documentId, nameSnapshot: result.fileName },
          metadata: sanitizeAuditMetadata({
            documentName: result.fileName,
            namingMode: 'manual',
            source: 'metadata_drawer',
          }),
          before: sanitizeAuditMetadata({ fileName: result.previousFileName }),
          after: sanitizeAuditMetadata({ fileName: result.fileName }),
          changes: [
            {
              field: 'currentFileName',
              before: result.previousFileName,
              after: result.fileName,
            },
          ],
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
