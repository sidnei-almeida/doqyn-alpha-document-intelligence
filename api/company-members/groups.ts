import type { VercelRequest, VercelResponse } from '@vercel/node';
import { updateGovernanceMemberDocumentGroups } from '../../server/services/governanceMembersService.js';
import { withAdminMongoApi } from '../../server/utils/apiHttp.js';
import { logger } from '../../server/utils/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  return withAdminMongoApi(req, res, {
    endpoint: '/api/company-members/:id/groups',
    handler: async ({ companyId, requestId, params, user }) => {
      const id = params.id;
      if (!id) {
        return { status: 400, body: { message: 'ID do membro é obrigatório.', code: 'MISSING_ID' } };
      }

      const body = (req.body ?? {}) as { groupIds?: string[]; documentGroupIds?: string[] };
      const groupIds = body.documentGroupIds ?? body.groupIds ?? [];
      if (!Array.isArray(groupIds)) {
        return {
          status: 400,
          body: { message: 'groupIds deve ser um array.', code: 'VALIDATION_ERROR' },
        };
      }

      const member = await updateGovernanceMemberDocumentGroups(req, user, companyId, id, groupIds);
      logger.info('member groups updated', {
        requestId,
        companyId,
        resource: 'company_members',
        id,
        groupCount: groupIds.length,
      });
      return { member };
    },
  });
}
