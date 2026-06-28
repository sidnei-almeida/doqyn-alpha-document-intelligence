import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  createDocumentGroup,
  listDocumentGroups,
} from '../../server/services/documentGroupsService.js';
import { apiCreated, withAdminMongoApi } from '../../server/utils/apiHttp.js';
import { logger } from '../../server/utils/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return withAdminMongoApi(req, res, {
      endpoint: '/api/document-groups',
      handler: async ({ companyId, requestId, user }) => {
        const groups = await listDocumentGroups(companyId, { ownerUserId: user.id });
        logger.info('document groups listed', {
          requestId,
          companyId,
          resource: 'document_groups',
          count: groups.length,
        });
        return { groups };
      },
    });
  }

  if (req.method === 'POST') {
    return withAdminMongoApi(req, res, {
      endpoint: '/api/document-groups',
      handler: async ({ companyId, requestId, user }) => {
        const body = (req.body ?? {}) as { name?: string; description?: string; slug?: string };
        const group = await createDocumentGroup(companyId, user.id, {
          name: body.name ?? '',
          description: body.description,
          slug: body.slug,
        });
        logger.info('document group created', {
          requestId,
          companyId,
          resource: 'document_groups',
          id: group.id,
        });
        return apiCreated({ group });
      },
    });
  }

  return res.status(405).json({ message: 'Método não permitido' });
}
