import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDocumentAuditContext } from '../../server/audit/buildDocumentAuditContext.js';
import { listDocumentTrackingEvents } from '../../server/audit/documentAuditLogService.js';
import { requireDocumentTrackingAccess } from '../../server/audit/requireDocumentTrackingAccess.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const {
    documentId,
    versionId,
    action,
    severity,
    status,
    actionGroup,
    requestId,
    actorUserId,
    from,
    to,
    q,
    category,
    cursor,
    limit,
  } = req.query;

  // O documento filtrado entra como escopo da guarda: com ele, o dono vê a trilha do próprio
  // documento sem governar o tenant (D-07); sem ele, a consulta cobre o tenant inteiro e exige
  // governança de tenant.
  const auth = await requireDocumentTrackingAccess(req, res, {
    documentId: typeof documentId === 'string' ? documentId : undefined,
  });
  if (!auth) return;

  // O tenant vem exclusivamente da sessão verificada, via `buildDocumentAuditContext(auth.ctx, …)`.
  // O parâmetro de query de tenant foi apagado desta superfície (D-08).
  try {
    const parsedLimit = typeof limit === 'string' ? Number.parseInt(limit, 10) : undefined;
    const auditCtx = buildDocumentAuditContext(auth.ctx, auth.user);

    const result = await listDocumentTrackingEvents({
      ctx: auditCtx,
      documentId: typeof documentId === 'string' ? documentId : undefined,
      versionId: typeof versionId === 'string' ? versionId : undefined,
      action: typeof action === 'string' ? action : undefined,
      severity: typeof severity === 'string' ? severity : undefined,
      status: typeof status === 'string' ? status : undefined,
      actionGroup: typeof actionGroup === 'string' ? actionGroup : undefined,
      requestId: typeof requestId === 'string' ? requestId : undefined,
      actorUserId: typeof actorUserId === 'string' ? actorUserId : undefined,
      from: typeof from === 'string' ? from : undefined,
      to: typeof to === 'string' ? to : undefined,
      q: typeof q === 'string' ? q : undefined,
      category: typeof category === 'string' ? category : undefined,
      cursor: typeof cursor === 'string' ? cursor : undefined,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    });

    return res.status(200).json({
      items: result.items,
      pagination: { nextCursor: result.nextCursor },
    });
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
