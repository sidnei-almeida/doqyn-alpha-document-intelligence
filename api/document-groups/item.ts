import type { VercelRequest, VercelResponse } from '@vercel/node';
import { updateDocumentGroup } from '../../server/services/documentGroupsService.js';
import { deactivateAccessRulesForGroup } from '../../server/services/documentAccessRulesService.js';
import { withAdminMongoApi } from '../../server/utils/apiHttp.js';
import { logger } from '../../server/utils/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const groupId = typeof req.query.id === 'string' ? req.query.id : (req.query.groupId as string);

  if (!groupId) {
    return res.status(400).json({ message: 'ID do grupo é obrigatório.', code: 'MISSING_ID' });
  }

  if (req.method === 'PATCH') {
    return withAdminMongoApi(req, res, {
      endpoint: '/api/document-groups/:groupId',
      handler: async ({ companyId, requestId, user }) => {
        const body = (req.body ?? {}) as {
          name?: string;
          description?: string;
          active?: boolean;
        };
        const group = await updateDocumentGroup(companyId, groupId, body, { ownerUserId: user.id });
        logger.info('document group updated', {
          requestId,
          companyId,
          resource: 'document_groups',
          id: groupId,
        });
        return { group };
      },
    });
  }

  if (req.method === 'DELETE') {
    return withAdminMongoApi(req, res, {
      endpoint: '/api/document-groups/:groupId',
      handler: async ({ companyId, requestId, user }) => {
        await updateDocumentGroup(companyId, groupId, { active: false }, { ownerUserId: user.id });
        await deactivateAccessRulesForGroup(companyId, groupId, { ownerUserId: user.id });
        logger.info('document group deactivated', {
          requestId,
          companyId,
          resource: 'document_groups',
          id: groupId,
        });
        return { id: groupId, active: false };
      },
    });
  }

  return res.status(405).json({ message: 'Método não permitido' });
}
