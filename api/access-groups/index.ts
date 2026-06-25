import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  createAccessGroup,
  listAccessGroups,
} from '../../server/services/accessGroupsService.js';
import { apiCreated, withAdminMongoApi } from '../../server/utils/apiHttp.js';
import { logger } from '../../server/utils/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return withAdminMongoApi(req, res, {
      endpoint: '/api/access-groups',
      handler: async ({ companyId, requestId }) => {
        const groups = await listAccessGroups(companyId);
        logger.info('access groups listed', {
          requestId,
          companyId,
          resource: 'access_groups',
          count: groups.length,
        });
        return { groups };
      },
    });
  }

  if (req.method === 'POST') {
    return withAdminMongoApi(req, res, {
      endpoint: '/api/access-groups',
      handler: async ({ companyId, requestId }) => {
        const body = (req.body ?? {}) as { name?: string; color?: string };
        const group = await createAccessGroup(companyId, {
          name: body.name ?? '',
          color: body.color,
        });
        logger.info('access group created', {
          requestId,
          companyId,
          resource: 'access_groups',
          id: group.id,
        });
        return apiCreated({ group });
      },
    });
  }

  return res.status(405).json({ message: 'Método não permitido' });
}
