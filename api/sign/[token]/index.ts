import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  buildSignatureAuditContext,
  buildSignatureTrackingMetadata,
  findSignatureRequestByToken,
  getSignaturePortalPayload,
} from '../../../server/services/signatures/documentSignatureService.js';
import { emitTrackingEvent } from '../../../server/services/tracking/trackingService.js';
import { isServiceError } from '../../../server/utils/serviceErrors.js';
import { sanitizeAuditMetadata } from '../../../server/utils/sanitizeAuditMetadata.js';

function resolveToken(req: VercelRequest): string | undefined {
  const value = req.query.token;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = resolveToken(req);
  if (!token) {
    return res.status(400).json({ message: 'token é obrigatório.', code: 'MISSING_TOKEN' });
  }

  try {
    if (req.method === 'GET') {
      const payload = await getSignaturePortalPayload(token);
      const request = await findSignatureRequestByToken(token);
      if (request) {
        const auditCtx = buildSignatureAuditContext(request);
        await emitTrackingEvent(
          auditCtx,
          {
            action: 'document.signature_link_opened',
            description: 'Link de assinatura eletrônica aberto.',
            documentId: request.documentId,
            versionId: request.versionId,
            metadata: sanitizeAuditMetadata(
              buildSignatureTrackingMetadata(request, { source: 'signature_portal' }),
            ),
            security: { isExternalGuest: true, authMethod: 'signature_token' },
          },
          req,
        );
      }
      return res.status(200).json(payload);
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
