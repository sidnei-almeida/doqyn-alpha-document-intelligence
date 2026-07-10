import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDocumentAuditContext } from '../../../server/audit/buildDocumentAuditContext.js';
import { createDocumentAuditLog } from '../../../server/audit/documentAuditLogService.js';
import { transferDocumentOwnership } from '../../../server/services/documentTransferOwnershipService.js';
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

function readBody(req: VercelRequest): { newOwnerUserId?: string; reason?: string } {
  const body = req.body as { newOwnerUserId?: unknown; reason?: unknown } | undefined;
  return {
    newOwnerUserId: typeof body?.newOwnerUserId === 'string' ? body.newOwnerUserId : undefined,
    reason: typeof body?.reason === 'string' ? body.reason : undefined,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
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

  const { newOwnerUserId, reason } = readBody(req);
  if (!newOwnerUserId?.trim()) {
    return res.status(400).json({
      message: 'newOwnerUserId é obrigatório.',
      code: 'MISSING_NEW_OWNER',
    });
  }

  try {
    const result = await transferDocumentOwnership(
      auth.ctx,
      auth.user,
      documentId,
      newOwnerUserId,
      reason,
    );

    const auditCtx = buildDocumentAuditContext(auth.ctx, auth.user, undefined, {
      documentOwnerUserId: result.newOwnerUserId,
    });

    await createDocumentAuditLog(auditCtx, {
      action: 'document.ownership_transferred',
      description: `Propriedade transferida para ${result.newOwnerName}.`,
      documentId,
      metadata: sanitizeAuditMetadata({
        source: 'api',
        previousOwnerUserId: result.previousOwnerUserId,
        previousOwnerName: result.previousOwnerName ?? null,
        newOwnerUserId: result.newOwnerUserId,
        newOwnerName: result.newOwnerName,
        reason: reason?.trim() || null,
      }),
    });

    await emitTrackingEvent(
      auditCtx,
      {
        action: 'document.ownership_transferred',
        description: `Propriedade transferida para ${result.newOwnerName}.`,
        documentId,
        metadata: sanitizeAuditMetadata({
          source: 'api',
          previousOwnerUserId: result.previousOwnerUserId,
          newOwnerUserId: result.newOwnerUserId,
          reason: reason?.trim() || null,
        }),
      },
      req,
    );

    return res.status(200).json({ ok: true, result });
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
