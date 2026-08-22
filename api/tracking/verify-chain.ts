import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuditChain } from '../../server/audit/auditChainVerification.js';
import { requireDocumentTrackingAccess } from '../../server/audit/requireDocumentTrackingAccess.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';

/**
 * Verificação da cadeia de integridade da trilha do tenant.
 *
 * Sem documento em escopo, a guarda exige quem governa o tenant — verificar a trilha inteira é
 * operação de auditoria, não de dono de documento.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentTrackingAccess(req, res);
  if (!auth) return;

  const limit = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : undefined;

  try {
    const result = await verifyAuditChain({
      tenantId: auth.ctx.tenantId,
      ownerUserId: auth.ctx.userId,
      membershipId: auth.ctx.membershipId,
      limit: Number.isFinite(limit) ? limit : undefined,
    });

    return res.status(200).json(result);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
