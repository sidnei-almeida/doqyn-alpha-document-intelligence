import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listSignatureRequestsAssignedToMe } from '../../server/services/signatures/documentSignatureService.js';
import { requireDocumentAuthContext } from '../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  try {
    const result = await listSignatureRequestsAssignedToMe(auth.ctx, auth.user);
    return res.status(200).json(result);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
