import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  buildExternalSignatureAuditContext,
  buildSignatureTrackingMetadata,
  findSignatureRequestByToken,
  readSignedPdfForToken,
} from '../../../server/services/signatures/documentSignatureService.js';
import { emitTrackingEvent } from '../../../server/services/tracking/trackingService.js';
import { isServiceError } from '../../../server/utils/serviceErrors.js';
import { sanitizeAuditMetadata } from '../../../server/utils/sanitizeAuditMetadata.js';

function resolveToken(req: VercelRequest): string | undefined {
  const value = req.query.token;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const token = resolveToken(req);
  if (!token) {
    return res.status(400).json({ message: 'token é obrigatório.', code: 'MISSING_TOKEN' });
  }

  try {
    const request = await findSignatureRequestByToken(token);
    const file = await readSignedPdfForToken(token);

    if (request) {
      await emitTrackingEvent(
        buildExternalSignatureAuditContext(request),
        {
          action: 'document.signature_downloaded',
          description: 'PDF assinado baixado pelo signatário.',
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

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    return res.status(200).send(file.buffer);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
