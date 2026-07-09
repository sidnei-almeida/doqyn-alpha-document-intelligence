import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDocumentAuditContext } from '../../server/audit/buildDocumentAuditContext.js';
import { requireDocumentAuthContext } from '../../server/tenancy/documentRequestContext.js';
import { emitClientTrackingEvent } from '../../server/services/tracking/trackingService.js';
import { hashTrackingValue } from '../../server/services/tracking/trackingSecurity.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const body = (req.body ?? {}) as Record<string, unknown>;
  const action = typeof body.action === 'string' ? body.action : '';
  const documentId = typeof body.documentId === 'string' ? body.documentId : undefined;
  const versionId = typeof body.versionId === 'string' ? body.versionId : undefined;
  const rawMetadata =
    body.metadata && typeof body.metadata === 'object'
      ? (body.metadata as Record<string, unknown>)
      : {};

  const metadata: Record<string, unknown> = { ...rawMetadata };

  if (typeof metadata.q === 'string' && metadata.q.trim()) {
    metadata.qLength = metadata.q.trim().length;
    metadata.qHash = hashTrackingValue(metadata.q.trim(), 'doqyn-search-v1');
    delete metadata.q;
  }

  try {
    const auditCtx = buildDocumentAuditContext(auth.ctx, auth.user);
    const result = await emitClientTrackingEvent(auditCtx, req, {
      action,
      documentId,
      versionId,
      metadata,
    });

    return res.status(201).json({ id: result?.id ?? null });
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
