import type { VercelRequest, VercelResponse } from '@vercel/node';
import { updateMemberStatus } from '../../server/services/companyMembersService.js';
import type { CompanyMemberStatus } from '../../server/db/types.js';
import { withAdminMongoApi } from '../../server/utils/apiHttp.js';
import { logger } from '../../server/utils/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  return withAdminMongoApi(req, res, {
    endpoint: '/api/company-members/:id/status',
    handler: async ({ companyId, requestId, params }) => {
      const id = params.id;
      if (!id) {
        return { status: 400, body: { message: 'ID do membro é obrigatório.', code: 'MISSING_ID' } };
      }

      const body = (req.body ?? {}) as { status?: CompanyMemberStatus };
      if (!body.status) {
        return {
          status: 400,
          body: { message: 'status é obrigatório.', code: 'VALIDATION_ERROR' },
        };
      }

      const member = await updateMemberStatus(companyId, id, body.status);
      logger.info('company member status updated', {
        requestId,
        companyId,
        resource: 'company_members',
        id,
        status: body.status,
      });
      return { member };
    },
  });
}
