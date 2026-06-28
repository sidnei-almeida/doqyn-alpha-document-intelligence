import type { VercelRequest, VercelResponse } from '@vercel/node';
import { toggleDocumentCategoryActive } from '../../server/services/documentCategoriesService.js';
import { withAdminMongoApi } from '../../server/utils/apiHttp.js';
import { logger } from '../../server/utils/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const categoryId = typeof req.query.id === 'string' ? req.query.id : '';

  return withAdminMongoApi(req, res, {
    endpoint: '/api/document-categories/:categoryId/toggle-active',
    handler: async ({ companyId, requestId, user, params }) => {
      const id = categoryId || params.id;
      if (!id) {
        return { status: 400, body: { message: 'ID obrigatório.', code: 'MISSING_ID' } };
      }

      const result = await toggleDocumentCategoryActive(companyId, id, { ownerUserId: user.id });
      logger.info('document category toggled', {
        requestId,
        companyId,
        resource: 'document_categories',
        id,
        active: result.active,
      });
      return result;
    },
  });
}
