import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDocumentAuditContext } from '../../server/audit/buildDocumentAuditContext.js';
import { requireDocumentTrackingAccess } from '../../server/audit/requireDocumentTrackingAccess.js';
import { assertTrackingTenantScope } from '../../server/auth/permissions.js';
import { assertQueryTenantMatchesSession } from '../../server/tenancy/documentRequestContext.js';
import { getTrackingSummary } from '../../server/services/tracking/trackingSummaryService.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentTrackingAccess(req, res);
  if (!auth) return;

  const { tenantId, from, to } = req.query;

  try {
    assertQueryTenantMatchesSession(typeof tenantId === 'string' ? tenantId : undefined, auth.ctx);
    assertTrackingTenantScope(
      auth.user,
      auth.ctx.tenantId,
      typeof tenantId === 'string' ? tenantId : undefined,
    );

    const summary = await getTrackingSummary({
      ctx: buildDocumentAuditContext(auth.ctx, auth.user),
      from: typeof from === 'string' ? from : undefined,
      to: typeof to === 'string' ? to : undefined,
    });

    return res.status(200).json(summary);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
