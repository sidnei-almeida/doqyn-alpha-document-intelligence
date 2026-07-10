import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDocumentAuditContext } from '../../../../../server/audit/buildDocumentAuditContext.js';
import { cancelDocumentSignatureRequest } from '../../../../../server/services/signatures/documentSignatureService.js';
import { emitTrackingEvent } from '../../../../../server/services/tracking/trackingService.js';
import { requireDocumentAuthContext } from '../../../../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../../../../server/utils/serviceErrors.js';
import { sanitizeAuditMetadata } from '../../../../../server/utils/sanitizeAuditMetadata.js';

function resolveIds(req: VercelRequest): { documentId?: string; signatureRequestId?: string } {
  const documentId = req.query.documentId;
  const signatureRequestId = req.query.signatureRequestId;
  return {
    documentId: typeof documentId === 'string' && documentId.trim() ? documentId.trim() : undefined,
    signatureRequestId:
      typeof signatureRequestId === 'string' && signatureRequestId.trim()
        ? signatureRequestId.trim()
        : undefined,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const { documentId, signatureRequestId } = resolveIds(req);
  if (!documentId) {
    return res.status(400).json({ message: 'documentId é obrigatório.', code: 'MISSING_DOCUMENT_ID' });
  }
  if (!signatureRequestId) {
    return res.status(400).json({ message: 'signatureRequestId é obrigatório.', code: 'MISSING_ID' });
  }

  const auditCtx = buildDocumentAuditContext(auth.ctx, auth.user);

  try {
    const result = await cancelDocumentSignatureRequest(
      auth.ctx,
      auth.user,
      signatureRequestId,
      { expectedDocumentId: documentId },
    );

    await emitTrackingEvent(
      auditCtx,
      {
        action: 'document.signature_request_cancelled',
        description: 'Solicitação de assinatura revogada.',
        documentId: result.documentId,
        metadata: sanitizeAuditMetadata({
          signatureRequestId: result.signatureRequestId,
          source: 'signature_request',
        }),
      },
      req,
    );

    return res.status(200).json(result);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
