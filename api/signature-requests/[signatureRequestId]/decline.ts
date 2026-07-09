import type { VercelRequest, VercelResponse } from '@vercel/node';
import { declineDocumentSignature } from '../../../server/services/signatures/documentSignatureService.js';
import { requireDocumentAuthContext } from '../../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../../server/utils/serviceErrors.js';

function resolveId(req: VercelRequest): string | undefined {
  const value = req.query.signatureRequestId;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
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

  const body = req.body as { reason?: string };

  try {
    await declineDocumentSignature({ signatureRequestId, reason: body.reason });
    return res.status(200).json({ status: 'declined' });
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
