import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDashboardOverview } from '../../server/services/dashboardOverviewService.js';
import {
  assertQueryTenantMatchesSession,
  requireDocumentAuthContext,
} from '../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const { tenantId, period, from, to } = req.query;

  try {
    assertQueryTenantMatchesSession(typeof tenantId === 'string' ? tenantId : undefined, auth.ctx);

    const overview = await getDashboardOverview({
      tenantId: auth.ctx.tenantId,
      userId: auth.ctx.userId,
      membershipId: auth.ctx.membershipId,
      user: auth.user,
      period: typeof period === 'string' ? period : undefined,
      from: typeof from === 'string' ? from : undefined,
      to: typeof to === 'string' ? to : undefined,
    });

    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json(overview);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
