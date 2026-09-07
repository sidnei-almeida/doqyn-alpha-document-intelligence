import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getTenantUsage } from '../../server/services/tenantUsageService.js';
import { requireDocumentAuthContext } from '../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  try {
    const usage = await getTenantUsage({
      tenantId: auth.ctx.tenantId,
      userId: auth.ctx.userId,
      membershipId: auth.ctx.membershipId,
      user: auth.user,
    });

    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json(usage);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
