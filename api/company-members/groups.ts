import type { VercelRequest, VercelResponse } from '@vercel/node';
import { updateMemberGroups } from '../../server/services/companyMembersService.js';
import { withAdminMongoApi } from '../../server/utils/apiHttp.js';
import { logger } from '../../server/utils/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  return withAdminMongoApi(req, res, {
    endpoint: '/api/company-members/:id/groups',
    handler: async ({ companyId, requestId, params }) => {
      const id = params.id;
      if (!id) {
        return { status: 400, body: { message: 'ID do membro é obrigatório.', code: 'MISSING_ID' } };
      }

      const body = (req.body ?? {}) as { groupIds?: string[] };
      const groupIds = body.groupIds ?? [];
      const member = await updateMemberGroups(companyId, id, groupIds);
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
