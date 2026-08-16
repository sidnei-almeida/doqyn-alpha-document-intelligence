import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDocumentAccessMatrix } from '../../../server/services/matrix/documentAccessMatrixService.js';
import { requireDocumentAuthContext } from '../../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../../server/utils/serviceErrors.js';

/**
 * Matriz de acesso: quem alcança cada documento e por qual caminho.
 *
 * O escopo não é decidido aqui — vem de `listDocuments`, o mesmo da Biblioteca. Administrador
 * enxerga o tenant, dono enxerga os próprios documentos, e a matriz não abre exceção.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const readString = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined;

  try {
    const matrix = await buildDocumentAccessMatrix({
      tenantId: auth.ctx.tenantId,
      user: auth.user,
      userId: auth.ctx.userId,
      membershipId: auth.ctx.membershipId,
      search: readString(req.query.search),
      categoryId: readString(req.query.categoryId),
      cursor: readString(req.query.cursor),
      limit: readString(req.query.limit) ? Number(req.query.limit) : undefined,
    });

    return res.status(200).json(matrix);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
