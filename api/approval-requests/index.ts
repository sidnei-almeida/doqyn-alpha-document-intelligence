import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listPendingApprovalsForTenant } from '../../server/services/approvals/pendingApprovalsQuery.js';
import { requireDocumentAuthContext } from '../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';

/**
 * A fila de pendências do tenant, em forma única.
 *
 * Antes ela era remendada no navegador: o cliente pedia a lista de membros, filtrava quem estava
 * `pending`, pedia as aprovações de envio e fundia as duas na mão. Cada coisa aprovável nova
 * custava mais uma chamada costurada ali. Aqui a fusão acontece uma vez, no servidor, e o
 * cliente recebe uma lista só.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  try {
    const limitRaw = Number(req.query.limit);
    const result = await listPendingApprovalsForTenant({
      tenantId: auth.ctx.tenantId,
      userId: auth.ctx.userId,
      platformRoles: auth.user.platformRoles ?? [],
      limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
      cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
    });

    return res.status(200).json(result);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
