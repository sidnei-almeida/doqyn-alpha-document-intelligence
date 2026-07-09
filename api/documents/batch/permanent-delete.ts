import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDocumentAuditContext } from '../../../server/audit/buildDocumentAuditContext.js';
import { batchPermanentlyDeleteDocuments } from '../../../server/services/trash/documentTrashService.js';
import { emitTrackingEvent } from '../../../server/services/tracking/trackingService.js';
import { requireDocumentAuthContext } from '../../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../../server/utils/serviceErrors.js';
import { sanitizeAuditMetadata } from '../../../server/utils/sanitizeAuditMetadata.js';

function readDocumentIds(req: VercelRequest): string[] {
  const body = req.body as { documentIds?: unknown } | undefined;
  if (!Array.isArray(body?.documentIds)) return [];
  return body.documentIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const documentIds = readDocumentIds(req);
  if (!documentIds.length) {
    return res.status(400).json({
      message: 'documentIds é obrigatório.',
      code: 'MISSING_DOCUMENT_IDS',
    });
  }

  const auditCtx = buildDocumentAuditContext(auth.ctx, auth.user);

  try {
    const result = await batchPermanentlyDeleteDocuments(auth.ctx, auth.user, documentIds);

    for (const row of result.results.filter((r) => r.ok)) {
      await emitTrackingEvent(
        auditCtx,
        {
          action: 'document.permanent_deleted',
          description: 'Documento excluído permanentemente (lote).',
          documentId: row.documentId,
          metadata: sanitizeAuditMetadata({ source: 'api', batch: true }),
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
