import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDocumentAuditContext } from '../../../server/audit/buildDocumentAuditContext.js';
import { moveDocumentToCategory } from '../../../server/services/documentMoveService.js';
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

function readBody(req: VercelRequest): { targetClassId?: string; reason?: string } {
  const body = req.body as { targetClassId?: unknown; reason?: unknown } | undefined;
  return {
    targetClassId: typeof body?.targetClassId === 'string' ? body.targetClassId : undefined,
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

  const { targetClassId, reason } = readBody(req);
  if (!targetClassId?.trim()) {
    return res.status(400).json({
      message: 'targetClassId é obrigatório.',
      code: 'MISSING_TARGET_CLASS',
    });
  }

  const auditCtx = buildDocumentAuditContext(auth.ctx, auth.user);

  try {
    const result = await moveDocumentToCategory(
      auth.ctx,
      auth.user,
      documentId,
      targetClassId,
      reason,
    );

    if (result.ok && !result.skipped) {
      await emitTrackingEvent(
        auditCtx,
        {
          action: 'document.moved',
          description: `Documento movido para ${result.newCategoryName ?? 'nova categoria'}.`,
          documentId,
          versionId: result.currentVersionId,
          metadata: sanitizeAuditMetadata({
            source: 'api',
            oldClassId: result.oldClassId,
            oldCategoryName: result.oldCategoryName,
            newClassId: result.newClassId,
            newCategoryName: result.newCategoryName,
            reason: reason?.trim() || null,
          }),
        },
        req,
      );
    }

    return res.status(200).json({
      ok: result.ok,
      moved: result.skipped ? 0 : 1,
      skipped: result.skipped ? [{ documentId, reason: result.reason ?? 'skipped' }] : [],
      targetClassId: result.newClassId,
      targetCategoryName: result.newCategoryName,
      result,
    });
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
