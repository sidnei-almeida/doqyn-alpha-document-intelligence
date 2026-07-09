import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDocumentAuditContext } from '../../../server/audit/buildDocumentAuditContext.js';
import { moveDocumentToTrash } from '../../../server/services/trash/documentTrashService.js';
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

function readReason(req: VercelRequest): string | undefined {
  const body = req.body as { reason?: string } | undefined;
  return typeof body?.reason === 'string' ? body.reason : undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
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
    const result = await moveDocumentToTrash(auth.ctx, auth.user, documentId, readReason(req));

    await emitTrackingEvent(
      auditCtx,
      {
        action: 'document.trash_moved',
        description: 'Documento movido para a lixeira.',
        documentId,
        metadata: sanitizeAuditMetadata({
          source: 'api',
          trashExpiresAt: result.trashExpiresAt,
          reason: readReason(req) ?? null,
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
