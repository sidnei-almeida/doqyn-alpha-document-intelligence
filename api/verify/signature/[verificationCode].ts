import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SHARED_APP_COLLECTIONS } from '../../../server/db/constants.js';
import { getDb } from '../../../server/db/mongoClient.js';
import type { MongoDocumentSignature, MongoDocumentSignatureRequest } from '../../../server/db/types.js';
import {
  buildSignatureAuditContext,
  getPublicSignatureVerification,
} from '../../../server/services/signatures/documentSignatureService.js';
import { emitTrackingEvent } from '../../../server/services/tracking/trackingService.js';
import { isServiceError } from '../../../server/utils/serviceErrors.js';
import { sanitizeAuditMetadata } from '../../../server/utils/sanitizeAuditMetadata.js';

function resolveCode(req: VercelRequest): string | undefined {
  const value = req.query.verificationCode;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const verificationCode = resolveCode(req);
  if (!verificationCode) {
    return res.status(400).json({ message: 'verificationCode é obrigatório.', code: 'MISSING_CODE' });
  }

  try {
    const result = await getPublicSignatureVerification(verificationCode);
    const db = await getDb();
    const signature = await db
      .collection<MongoDocumentSignature>(SHARED_APP_COLLECTIONS.documentSignatures)
      .findOne({ verificationCode: verificationCode.trim() });
    const request = signature
      ? await db
          .collection<MongoDocumentSignatureRequest>(SHARED_APP_COLLECTIONS.documentSignatureRequests)
          .findOne({ signatureRequestId: signature.signatureRequestId })
      : null;

    if (request) {
      await emitTrackingEvent(
        buildSignatureAuditContext(request),
        {
          action: 'document.signature_verification_opened',
          description: 'Validação pública de assinatura aberta.',
          documentId: request.documentId,
          versionId: request.versionId,
          metadata: sanitizeAuditMetadata({
            verificationCode: result.verificationCode,
            source: 'signature_verification',
          }),
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
