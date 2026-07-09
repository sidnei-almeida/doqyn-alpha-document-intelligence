import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDocumentAuditContext } from '../../../server/audit/buildDocumentAuditContext.js';
import { completeDocumentSignature, getDocumentSignatureRequest } from '../../../server/services/signatures/documentSignatureService.js';
import { emitTrackingEvent } from '../../../server/services/tracking/trackingService.js';
import { requireDocumentAuthContext } from '../../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../../server/utils/serviceErrors.js';
import { sanitizeAuditMetadata } from '../../../server/utils/sanitizeAuditMetadata.js';

function resolveId(req: VercelRequest): string | undefined {
  const value = req.query.signatureRequestId;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function resolveOrigin(req: VercelRequest): string | undefined {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin.trim()) return origin.trim();
  return undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const signatureRequestId = resolveId(req);
  if (!signatureRequestId) {
    return res.status(400).json({ message: 'signatureRequestId é obrigatório.', code: 'MISSING_ID' });
  }

  const body = req.body as { consentAccepted?: boolean };
  const auditCtx = buildDocumentAuditContext(auth.ctx, auth.user);

  try {
    const result = await completeDocumentSignature({
      signatureRequestId,
      consentAccepted: body.consentAccepted === true,
      authUser: auth.user,
      req,
      origin: resolveOrigin(req),
    });

    const request = await getDocumentSignatureRequest(auth.ctx, auth.user, signatureRequestId);

    await emitTrackingEvent(
      auditCtx,
      {
        action: 'document.signature_completed',
        description: 'Assinatura eletrônica concluída.',
        documentId: request.documentId,
        versionId: request.versionId,
        metadata: sanitizeAuditMetadata({
          signatureRequestId,
          signatureId: result.signatureId,
          verificationCode: result.verificationCode,
          source: 'signature_internal',
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
