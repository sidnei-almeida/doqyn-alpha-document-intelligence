import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDocumentAuditContext } from '../../../server/audit/buildDocumentAuditContext.js';
import {
  buildSignatureTrackingMetadata,
  readSignedPdfForAuthenticatedRequest,
} from '../../../server/services/signatures/documentSignatureService.js';
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
    const file = await readSignedPdfForAuthenticatedRequest(
      auth.ctx,
      auth.user,
      signatureRequestId,
    );
    const auditCtx = buildDocumentAuditContext(auth.ctx, auth.user);

    await emitTrackingEvent(
      auditCtx,
      {
        action: 'document.signature_downloaded',
        description: 'PDF assinado baixado por usuário interno.',
        documentId: file.request.documentId,
        versionId: file.request.versionId,
        metadata: sanitizeAuditMetadata(
          buildSignatureTrackingMetadata(file.request, {
            signatureId: file.signature.signatureId,
            verificationCode: file.signature.verificationCode,
            source: 'library',
          }),
        ),
      },
      req,
    );

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
