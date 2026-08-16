import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDocumentMetadataMatrix } from '../../../server/services/matrix/documentMetadataMatrixService.js';
import { requireDocumentAuthContext } from '../../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../../server/utils/serviceErrors.js';

/**
 * Matriz de metadados de uma categoria: os mesmos campos, em coluna, para vários documentos.
 *
 * `categoryId` é obrigatório porque as colunas saem da regra da categoria — sem ela, cada linha
 * teria um conjunto de campos diferente e a tela deixaria de ser uma matriz.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const auth = await requireDocumentAuthContext(req, res);
  if (!auth) return;

  const readString = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined;

  const categoryId = readString(req.query.categoryId);
  if (!categoryId) {
    return res
      .status(400)
      .json({ message: 'categoryId é obrigatório.', code: 'VALIDATION_ERROR' });
  }

  try {
    const matrix = await buildDocumentMetadataMatrix({
      tenantId: auth.ctx.tenantId,
      user: auth.user,
      userId: auth.ctx.userId,
      membershipId: auth.ctx.membershipId,
      categoryId,
      search: readString(req.query.search),
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
