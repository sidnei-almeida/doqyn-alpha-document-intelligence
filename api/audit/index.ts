import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listAuditEvents } from '../../server/services/auditService.js';
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

  const { tenantId, documentId, q, type, severity, actorId, from, to, limit, cursor, category } =
    req.query;

  try {
    assertQueryTenantMatchesSession(typeof tenantId === 'string' ? tenantId : undefined, ctx);

    const result = await listAuditEvents({
      tenantId: ctx.tenantId,
      ownerUserId: ctx.userId,
      documentId: typeof documentId === 'string' ? documentId : undefined,
      q: typeof q === 'string' ? q : undefined,
      type: typeof type === 'string' ? type : undefined,
      severity: typeof severity === 'string' ? severity : undefined,
      actorId: typeof actorId === 'string' ? actorId : undefined,
      from: typeof from === 'string' ? from : undefined,
      to: typeof to === 'string' ? to : undefined,
      limit: typeof limit === 'string' ? Number(limit) : undefined,
      cursor: typeof cursor === 'string' ? cursor : undefined,
      category: category === 'security' ? 'security' : undefined,
    });

    return res.status(200).json(result);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
