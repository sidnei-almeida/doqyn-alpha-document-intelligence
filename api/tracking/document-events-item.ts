import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDocumentAuditContext } from '../../server/audit/buildDocumentAuditContext.js';
import { getDocumentTrackingEvent } from '../../server/audit/documentAuditLogService.js';
import { requireDocumentTrackingAccess } from '../../server/audit/requireDocumentTrackingAccess.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentTrackingAccess(req, res);
  if (!auth) return;

  const eventId =
    typeof req.query.eventId === 'string'
      ? req.query.eventId
      : typeof req.query.id === 'string'
        ? req.query.id
        : undefined;

  if (!eventId?.trim()) {
    return res.status(400).json({
      message: 'eventId é obrigatório.',
      code: 'MISSING_EVENT_ID',
    });
  }

  try {
    const auditCtx = buildDocumentAuditContext(auth.ctx, auth.user);
    const event = await getDocumentTrackingEvent({
      ctx: auditCtx,
      eventId: eventId.trim(),
    });

    return res.status(200).json({ event });
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
