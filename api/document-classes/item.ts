import type { VercelRequest, VercelResponse } from '@vercel/node';
import { updateDocumentClass } from '../../server/services/documentClassesService.js';
import { withAdminMongoApi } from '../../server/utils/apiHttp.js';
import { logger } from '../../server/utils/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  return withAdminMongoApi(req, res, {
    endpoint: '/api/document-classes/:id',
    handler: async ({ companyId, requestId, params }) => {
      const id = params.id;
      if (!id) {
        return { status: 400, body: { message: 'ID da classe é obrigatório.', code: 'MISSING_ID' } };
      }

      const body = (req.body ?? {}) as {
        name?: string;
        description?: string;
        keywords?: string[];
        negativeKeywords?: string[];
        iconKey?: string;
        color?: string;
        active?: boolean;
      };
      const docClass = await updateDocumentClass(companyId, id, body);
      logger.info('document class updated', {
        requestId,
        companyId,
        resource: 'document_classes',
        id,
      });
      return { class: docClass };
    },
  });
}
