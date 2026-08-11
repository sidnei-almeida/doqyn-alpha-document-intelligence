import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDocumentDetail, listDocuments } from '../../server/services/documentService.js';
import { requireDocumentAuthContext } from '../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const auth = await requireDocumentAuthContext(req, res);
    if (!auth) return;

    const {
      id,
      search,
      status,
      processingStatus,
      type,
      area,
      categoryId,
      from,
      to,
      sort,
      direction,
      owner,
      excludeArchived,
      limit,
      cursor,
    } = req.query;

    // O tenant vem exclusivamente da sessão verificada (`auth.ctx.tenantId`). O cliente não propõe
    // tenant nesta rota — D-08 apagou o parâmetro em vez de endurecer a validação dele.
    try {
      if (id && typeof id === 'string') {
        const detail = await getDocumentDetail(
          id,
          auth.ctx.tenantId,
          auth.ctx.userId,
          auth.user,
          auth.ctx.membershipId,
        );
        if (!detail) {
          return res.status(404).json({
            message: 'Documento não encontrado.',
            code: 'DOCUMENT_NOT_FOUND',
          });
        }
        return res.status(200).json(detail);
      }

      const result = await listDocuments({
        tenantId: auth.ctx.tenantId,
        ownerUserId: auth.ctx.userId,
        membershipId: auth.ctx.membershipId,
        user: auth.user,
        search: typeof search === 'string' ? search : undefined,
        status: typeof status === 'string' ? status : undefined,
        processingStatus: typeof processingStatus === 'string' ? processingStatus : undefined,
        type: typeof type === 'string' ? type : undefined,
        area: typeof area === 'string' ? area : undefined,
        categoryId: typeof categoryId === 'string' ? categoryId : undefined,
        from: typeof from === 'string' ? from : undefined,
        to: typeof to === 'string' ? to : undefined,
        sort: typeof sort === 'string' ? sort : undefined,
        direction: typeof direction === 'string' ? direction : undefined,
        owner: typeof owner === 'string' ? owner : undefined,
        excludeArchived: typeof excludeArchived === 'string' ? excludeArchived : undefined,
        limit: typeof limit === 'string' ? Number(limit) : undefined,
        cursor: typeof cursor === 'string' ? cursor : undefined,
      });

      return res.status(200).json(result);
    } catch (error) {
      if (isServiceError(error)) {
        return res.status(error.statusCode).json({ message: error.message, code: error.code });
      }
      throw error;
    }
  }

  return res.status(405).json({ message: 'Método não permitido' });
}
