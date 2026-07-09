import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listTrashDocuments } from '../../server/services/trash/documentTrashService.js';
import { requireDocumentAuthContext } from '../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;

  try {
    const result = await listTrashDocuments(auth.ctx, auth.user, { search, limit });
    return res.status(200).json(result);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
