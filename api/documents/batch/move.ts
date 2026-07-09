import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDocumentAuditContext } from '../../../server/audit/buildDocumentAuditContext.js';
import { batchMoveDocumentsToCategory } from '../../../server/services/documentMoveService.js';
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

  const body = req.body as {
    documentIds?: unknown;
    targetClassId?: unknown;
    reason?: unknown;
  };

  const documentIds = readDocumentIds(req);
  if (!documentIds.length) {
    return res.status(400).json({
      message: 'documentIds é obrigatório.',
      code: 'MISSING_DOCUMENT_IDS',
    });
  }

  const targetClassId = typeof body.targetClassId === 'string' ? body.targetClassId : undefined;
  if (!targetClassId?.trim()) {
    return res.status(400).json({
      message: 'targetClassId é obrigatório.',
      code: 'MISSING_TARGET_CLASS',
    });
  }

  const reason = typeof body.reason === 'string' ? body.reason : undefined;
  const auditCtx = buildDocumentAuditContext(auth.ctx, auth.user);

  try {
    const result = await batchMoveDocumentsToCategory(
      auth.ctx,
      auth.user,
      documentIds,
      targetClassId,
      reason,
    );

    for (const row of result.results.filter((r) => r.ok && !r.skipped)) {
      await emitTrackingEvent(
        auditCtx,
        {
          action: 'document.moved',
          description: `Documento movido para ${result.targetCategoryName} (lote).`,
          documentId: row.documentId,
          versionId: row.currentVersionId,
          metadata: sanitizeAuditMetadata({
            source: 'api',
            batch: true,
            oldClassId: row.oldClassId,
            oldCategoryName: row.oldCategoryName,
            newClassId: row.newClassId,
            newCategoryName: row.newCategoryName,
            reason: reason?.trim() || null,
          }),
        },
        req,
      );
    }

    return res.status(200).json({
      ok: result.ok,
      moved: result.moved,
      skipped: result.skipped,
      failed: result.failed,
      targetClassId: result.targetClassId,
      targetCategoryName: result.targetCategoryName,
      results: result.results,
    });
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
