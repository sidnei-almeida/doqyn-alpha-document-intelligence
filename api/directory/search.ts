import type { VercelRequest, VercelResponse } from '@vercel/node';
import { searchDirectoryUsers } from '../../server/services/directory/directoryLookupService.js';
import { requireDocumentAuthContext } from '../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const q = typeof req.query.q === 'string' ? req.query.q : undefined;

  try {
    const results = await searchDirectoryUsers(auth.ctx, auth.user, q);
    return res.status(200).json({ results, total: results.length });
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
