import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDocumentAuditContext } from '../../server/audit/buildDocumentAuditContext.js';
import { listDocumentTimeline } from '../../server/audit/documentAuditLogService.js';
import { requireDocumentTrackingAccess } from '../../server/audit/requireDocumentTrackingAccess.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentTrackingAccess(req, res);
  if (!auth) return;

  const documentId =
    typeof req.query.documentId === 'string'
      ? req.query.documentId
      : typeof req.query.id === 'string'
        ? req.query.id
        : undefined;

  if (!documentId?.trim()) {
    return res.status(400).json({
      message: 'documentId é obrigatório.',
      code: 'MISSING_DOCUMENT_ID',
    });
  }

  const limit =
    typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : undefined;
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
  const actionPrefix =
    typeof req.query.actionPrefix === 'string' ? req.query.actionPrefix : undefined;

  try {
    const auditCtx = buildDocumentAuditContext(auth.ctx, auth.user);
    const result = await listDocumentTimeline({
      ctx: auditCtx,
      documentId: documentId.trim(),
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
      actionPrefix,
    });

    return res.status(200).json({
      items: result.items,
      pagination: {
        nextCursor: result.nextCursor,
      },
    });
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
