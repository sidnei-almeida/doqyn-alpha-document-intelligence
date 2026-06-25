import type { VercelRequest, VercelResponse } from '@vercel/node';
import { toggleDocumentClassActive } from '../../server/services/documentClassesService.js';
import { withAdminMongoApi } from '../../server/utils/apiHttp.js';
import { logger } from '../../server/utils/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  return withAdminMongoApi(req, res, {
    endpoint: '/api/document-classes/:id/toggle-active',
    handler: async ({ companyId, requestId, params }) => {
      const id = params.id;
      if (!id) {
        return { status: 400, body: { message: 'ID da classe é obrigatório.', code: 'MISSING_ID' } };
      }

      const result = await toggleDocumentClassActive(companyId, id);
      logger.info('document class toggle-active', {
        requestId,
        companyId,
        resource: 'document_classes',
        id,
        active: result.active,
      });
      return result;
    },
  });
}
