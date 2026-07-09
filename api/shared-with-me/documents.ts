import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listSharedWithMeDocuments } from '../../server/services/sharing/documentShareService.js';
import { requireDocumentAuthContext } from '../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const search = typeof req.query.search === 'string' ? req.query.search : undefined;

  try {
    const result = await listSharedWithMeDocuments(auth.user, auth.ctx.membershipId, search);
    return res.status(200).json({
      items: result.items,
      documents: result.items,
      total: result.total,
      pagination: { nextCursor: null },
    });
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
