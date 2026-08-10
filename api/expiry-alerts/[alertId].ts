import type { VercelRequest, VercelResponse } from '@vercel/node';
import { updateExpiryAlertStatus } from '../../server/services/expiry/documentExpiryAlertService.js';
import { requireDocumentAuthContext } from '../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH' && req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const alertId = String(req.query.alertId ?? '').trim();
  if (!alertId) {
    return res.status(400).json({ message: 'alertId é obrigatório.', code: 'VALIDATION_ERROR' });
  }

  const status = String((req.body as { status?: unknown })?.status ?? '').trim();
  if (status !== 'read' && status !== 'dismissed') {
    return res
      .status(400)
      .json({ message: 'status deve ser read ou dismissed.', code: 'VALIDATION_ERROR' });
  }

  try {
    const alert = await updateExpiryAlertStatus({
      tenantId: auth.ctx.tenantId,
      userId: auth.ctx.userId,
      alertId,
      status,
    });
    return res.status(200).json({ alert });
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
