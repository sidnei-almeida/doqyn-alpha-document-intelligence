import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuditOverview } from '../../server/services/auditService.js';
import {
  assertQueryTenantMatchesSession,
  requireDocumentRequestContext,
} from '../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const ctx = await requireDocumentRequestContext(req, res);
  if (!ctx) return;

  const { tenantId } = req.query;

  try {
    assertQueryTenantMatchesSession(typeof tenantId === 'string' ? tenantId : undefined, ctx);

    const overview = await getAuditOverview({
      tenantId: ctx.tenantId,
      ownerUserId: ctx.userId,
    });

    return res.status(200).json({
      pendingCount: 0,
      pendingUsersCount: 0,
      ...overview,
    });
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
