import type { VercelRequest, VercelResponse } from '@vercel/node';
import { updateNotificationStatus } from '../../server/services/notifications/notificationService.js';
import { requireDocumentAuthContext } from '../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH' && req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const notificationId = String(req.query.notificationId ?? '').trim();
  if (!notificationId) {
    return res
      .status(400)
      .json({ message: 'notificationId é obrigatório.', code: 'VALIDATION_ERROR' });
  }

  const status = String((req.body as { status?: unknown })?.status ?? '').trim();
  if (status !== 'read' && status !== 'dismissed') {
    return res
      .status(400)
      .json({ message: 'status deve ser read ou dismissed.', code: 'VALIDATION_ERROR' });
  }

  try {
    const notification = await updateNotificationStatus({
      tenantId: auth.ctx.tenantId,
      userId: auth.ctx.userId,
      notificationId,
      status,
    });
    return res.status(200).json({ notification });
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
