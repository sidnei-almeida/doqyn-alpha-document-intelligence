import type { VercelRequest, VercelResponse } from '@vercel/node';
import { lookupDirectoryTarget } from '../../server/services/directory/directoryLookupService.js';
import { requireDocumentAuthContext } from '../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const email = typeof req.query.email === 'string' ? req.query.email : undefined;

  try {
    const result = await lookupDirectoryTarget(auth.ctx, auth.user, email);
    return res.status(200).json(result);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
