import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDocumentAuditContext } from '../../../server/audit/buildDocumentAuditContext.js';
import { getInternalSignatureSigningPayload } from '../../../server/services/signatures/documentSignatureService.js';
import { emitTrackingEvent } from '../../../server/services/tracking/trackingService.js';
import { requireDocumentAuthContext } from '../../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../../server/utils/serviceErrors.js';
import { sanitizeAuditMetadata } from '../../../server/utils/sanitizeAuditMetadata.js';

function resolveId(req: VercelRequest): string | undefined {
  const value = req.query.signatureRequestId;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const signatureRequestId = resolveId(req);
  if (!signatureRequestId) {
    return res.status(400).json({ message: 'signatureRequestId é obrigatório.', code: 'MISSING_ID' });
  }

  try {
    const payload = await getInternalSignatureSigningPayload(auth.ctx, auth.user, signatureRequestId);
    const auditCtx = buildDocumentAuditContext(auth.ctx, auth.user);
    await emitTrackingEvent(
      auditCtx,
      {
        action: 'document.signature_internal_opened',
        description: 'Solicitação de assinatura interna aberta.',
        documentId: payload.documentId,
        versionId: payload.versionId,
        metadata: sanitizeAuditMetadata({
          signatureRequestId: payload.signatureRequestId,
          signerType: 'internal_user',
          source: 'signature_internal',
        }),
      },
      req,
    );
    return res.status(200).json(payload);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
