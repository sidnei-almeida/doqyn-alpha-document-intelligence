import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  addGroupMember,
  listGroupMembers,
  removeGroupMember,
} from '../../server/services/documentGroupsService.js';
import { withAdminMongoApi } from '../../server/utils/apiHttp.js';
import { logger } from '../../server/utils/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const groupId = typeof req.query.groupId === 'string' ? req.query.groupId : '';
  const membershipId = typeof req.query.membershipId === 'string' ? req.query.membershipId : '';

  if (!groupId) {
    return res.status(400).json({ message: 'groupId é obrigatório.', code: 'MISSING_GROUP_ID' });
  }

  if (req.method === 'GET') {
    return withAdminMongoApi(req, res, {
      endpoint: '/api/document-groups/:groupId/members',
      handler: async ({ companyId, requestId, user }) => {
        const members = await listGroupMembers(companyId, groupId, { ownerUserId: user.id });
        logger.info('document group members listed', {
          requestId,
          companyId,
          resource: 'document_group_members',
          groupId,
          count: members.length,
        });
        return { members, groupId };
      },
    });
  }

  if (req.method === 'POST') {
    return withAdminMongoApi(req, res, {
      endpoint: '/api/document-groups/:groupId/members',
      handler: async ({ companyId, requestId, user }) => {
        const body = (req.body ?? {}) as {
          membershipId?: string;
          userId?: string;
          displayName?: string;
          email?: string;
        };

        if (!body.membershipId?.trim() || !body.userId?.trim()) {
          return {
            status: 400,
            body: { message: 'membershipId e userId são obrigatórios.', code: 'VALIDATION_ERROR' },
          };
        }

        const member = await addGroupMember(companyId, groupId, user.id, {
          membershipId: body.membershipId.trim(),
          userId: body.userId.trim(),
          displayName: body.displayName,
          email: body.email,
        });

        logger.info('document group member added', {
          requestId,
          companyId,
          resource: 'document_group_members',
          groupId,
          membershipId: body.membershipId,
        });
        return { member };
      },
    });
  }

  if (req.method === 'DELETE') {
    if (!membershipId) {
      return res.status(400).json({ message: 'membershipId é obrigatório.', code: 'MISSING_ID' });
    }

    return withAdminMongoApi(req, res, {
      endpoint: '/api/document-groups/:groupId/members/:membershipId',
      handler: async ({ companyId, requestId, user }) => {
        const result = await removeGroupMember(companyId, groupId, membershipId, {
          ownerUserId: user.id,
        });
        logger.info('document group member removed', {
          requestId,
          companyId,
          resource: 'document_group_members',
          groupId,
          membershipId,
        });
        return result;
      },
    });
  }

  return res.status(405).json({ message: 'Método não permitido' });
}
