import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  buildSignatureAuditContext,
  buildSignatureTrackingMetadata,
  completeDocumentSignature,
  findSignatureRequestByToken,
} from '../../../server/services/signatures/documentSignatureService.js';
import { emitTrackingEvent } from '../../../server/services/tracking/trackingService.js';
import { isServiceError } from '../../../server/utils/serviceErrors.js';
import { sanitizeAuditMetadata } from '../../../server/utils/sanitizeAuditMetadata.js';

function resolveToken(req: VercelRequest): string | undefined {
  const value = req.query.token;
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

  const token = resolveToken(req);
  if (!token) {
    return res.status(400).json({ message: 'token é obrigatório.', code: 'MISSING_TOKEN' });
  }

  const body = req.body as { action?: string; consentAccepted?: boolean; reason?: string };

  try {
    const request = await findSignatureRequestByToken(token);
    const result = await completeDocumentSignature({
      token,
      consentAccepted: body.consentAccepted === true,
      req,
      origin: resolveOrigin(req),
    });

    if (request) {
      const auditCtx = buildSignatureAuditContext(request);
      await emitTrackingEvent(
        auditCtx,
        {
          action: 'document.signature_completed',
          description: 'Assinatura eletrônica concluída.',
          documentId: request.documentId,
          versionId: request.versionId,
          metadata: sanitizeAuditMetadata(
            buildSignatureTrackingMetadata(request, {
              signatureId: result.signatureId,
              verificationCode: result.verificationCode,
              source: 'signature_portal',
            }),
          ),
          security: { isExternalGuest: true, authMethod: 'signature_token' },
        },
        req,
      );
      await emitTrackingEvent(
        auditCtx,
        {
          action: 'document.signed_pdf_generated',
          description: 'PDF assinado gerado.',
          documentId: request.documentId,
          versionId: request.versionId,
          metadata: sanitizeAuditMetadata(
            buildSignatureTrackingMetadata(request, { signatureId: result.signatureId }),
          ),
        },
        req,
      );
    }

    return res.status(200).json(result);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
