import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cancelDocumentRequest } from '../../../server/services/requests/documentRequestService.js';
import { requireDocumentAuthContext } from '../../../server/tenancy/documentRequestContext.js';
import { buildDocumentAuditContext } from '../../../server/audit/buildDocumentAuditContext.js';
import { emitTrackingEvent } from '../../../server/services/tracking/trackingService.js';
import { sanitizeAuditMetadata } from '../../../server/utils/sanitizeAuditMetadata.js';
import { isServiceError } from '../../../server/utils/serviceErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const requestId = typeof req.query.requestId === 'string' ? req.query.requestId : '';
  if (!requestId) {
    return res.status(400).json({ message: 'Pedido não informado.', code: 'REQUEST_ID_REQUIRED' });
  }

  try {
    const request = await cancelDocumentRequest(auth.ctx, auth.user, requestId);

    await emitTrackingEvent(
      buildDocumentAuditContext(auth.ctx, auth.user),
      {
        action: 'document_request.cancelled',
        description: 'Requisição de documento cancelada.',
        metadata: sanitizeAuditMetadata({
          requestId: request._id,
          requestedFromUserId: request.requestedFrom.userId,
        }),
      },
      req,
    );

    return res.status(200).json({ request });
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
