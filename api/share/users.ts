import type { VercelRequest, VercelResponse } from '@vercel/node';
import { searchShareableTenantUsers } from '../../server/services/sharing/documentShareService.js';
import { requireDocumentAuthContext } from '../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  const documentId =
    typeof req.query.documentId === 'string' ? req.query.documentId : undefined;

  try {
    const result = await searchShareableTenantUsers(auth.ctx, auth.user, q, documentId);
    return res.status(200).json(result);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
