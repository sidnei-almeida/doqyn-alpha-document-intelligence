import type { VercelRequest, VercelResponse } from '@vercel/node';
import { updateAccessGroup } from '../../server/services/accessGroupsService.js';
import { withAdminMongoApi } from '../../server/utils/apiHttp.js';
import { logger } from '../../server/utils/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  return withAdminMongoApi(req, res, {
    endpoint: '/api/access-groups/:id',
    handler: async ({ companyId, requestId, params }) => {
      const id = params.id;
      if (!id) {
        return { status: 400, body: { message: 'ID do grupo é obrigatório.', code: 'MISSING_ID' } };
      }

      const body = (req.body ?? {}) as { name?: string; color?: string; active?: boolean };
      const group = await updateAccessGroup(companyId, id, body);
      logger.info('access group updated', {
        requestId,
        companyId,
        resource: 'access_groups',
        id,
      });
      return { group };
    },
  });
}
