import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  listUserExpiryAlerts,
  markAllExpiryAlertsRead,
} from '../../server/services/expiry/documentExpiryAlertService.js';
import { requireDocumentAuthContext } from '../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  try {
    if (req.method === 'GET') {
      const statusRaw = String(req.query.status ?? '').trim();
      const status =
        statusRaw === 'unread' || statusRaw === 'read' || statusRaw === 'dismissed'
          ? statusRaw
          : undefined;

      const limitRaw = Number(req.query.limit);
      const result = await listUserExpiryAlerts({
        tenantId: auth.ctx.tenantId,
        userId: auth.ctx.userId,
        status,
        limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
      });

      return res.status(200).json(result);
    }

    // Marcar tudo como lido é a ação de "limpar o sino", não a criação de um recurso.
    if (req.method === 'POST') {
      const result = await markAllExpiryAlertsRead({
        tenantId: auth.ctx.tenantId,
        userId: auth.ctx.userId,
      });
      return res.status(200).json(result);
    }

    return res.status(405).json({ message: 'Método não permitido' });
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
