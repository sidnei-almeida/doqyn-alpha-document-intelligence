import type { VercelRequest, VercelResponse } from '@vercel/node';
import { toggleAccessGroupActive } from '../../server/services/accessGroupsService.js';
import { withAdminMongoApi } from '../../server/utils/apiHttp.js';
import { logger } from '../../server/utils/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  return withAdminMongoApi(req, res, {
    endpoint: '/api/access-groups/:id/toggle-active',
    handler: async ({ companyId, requestId, params }) => {
      const id = params.id;
      if (!id) {
        return { status: 400, body: { message: 'ID do grupo é obrigatório.', code: 'MISSING_ID' } };
      }

      const result = await toggleAccessGroupActive(companyId, id);
      logger.info('access group toggle-active', {
        requestId,
        companyId,
        resource: 'access_groups',
        id,
        active: result.active,
      });
      return result;
    },
  });
}
