import type { VercelRequest, VercelResponse } from '@vercel/node';
import { updateDocumentClassNotifications } from '../../server/services/documentClassesService.js';
import { withAdminMongoApi } from '../../server/utils/apiHttp.js';
import { logger } from '../../server/utils/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  return withAdminMongoApi(req, res, {
    endpoint: '/api/document-classes/:id/notifications',
    handler: async ({ companyId, requestId, params }) => {
      const id = params.id;
      if (!id) {
        return { status: 400, body: { message: 'ID da classe é obrigatório.', code: 'MISSING_ID' } };
      }

      const body = (req.body ?? {}) as { notifyOnUpdate?: boolean; notifyGroups?: string[] };
      if (body.notifyOnUpdate === undefined) {
        return {
          status: 400,
          body: { message: 'notifyOnUpdate é obrigatório.', code: 'VALIDATION_ERROR' },
        };
      }

      const docClass = await updateDocumentClassNotifications(companyId, id, {
        notifyOnUpdate: body.notifyOnUpdate,
        notifyGroups: body.notifyGroups,
      });
      logger.info('document class notifications updated', {
        requestId,
        companyId,
        resource: 'document_classes',
        id,
        notifyOnUpdate: body.notifyOnUpdate,
      });
      return { class: docClass };
    },
  });
}
