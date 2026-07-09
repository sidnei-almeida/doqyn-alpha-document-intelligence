import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDocumentAuditContext } from '../../../server/audit/buildDocumentAuditContext.js';
import { permanentlyDeleteDocument } from '../../../server/services/trash/documentTrashService.js';
import { emitTrackingEvent } from '../../../server/services/tracking/trackingService.js';
import { requireDocumentAuthContext } from '../../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../../server/utils/serviceErrors.js';
import { sanitizeAuditMetadata } from '../../../server/utils/sanitizeAuditMetadata.js';

function resolveDocumentId(req: VercelRequest): string | undefined {
  const fromQuery = req.query.documentId;
  if (typeof fromQuery === 'string' && fromQuery.trim()) return fromQuery.trim();
  const fromId = req.query.id;
  if (typeof fromId === 'string' && fromId.trim()) return fromId.trim();
  return undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const documentId = resolveDocumentId(req);
  if (!documentId) {
    return res.status(400).json({
      message: 'documentId é obrigatório.',
      code: 'MISSING_DOCUMENT_ID',
    });
  }

  const auditCtx = buildDocumentAuditContext(auth.ctx, auth.user);

  try {
    const result = await permanentlyDeleteDocument(auth.ctx, auth.user, documentId);

    const action =
      result.purgeStatus === 'failed'
        ? 'document.trash_purge_failed'
        : 'document.permanent_deleted';

    await emitTrackingEvent(
      auditCtx,
      {
        action,
        description:
          result.purgeStatus === 'failed'
            ? 'Falha ao remover arquivos do storage na exclusão permanente.'
            : 'Documento excluído permanentemente.',
        documentId,
        result: result.purgeStatus === 'failed' ? 'error' : 'success',
        metadata: sanitizeAuditMetadata({
          source: 'api',
          purgeStatus: result.purgeStatus,
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
