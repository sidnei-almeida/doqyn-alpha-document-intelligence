import type { VercelRequest, VercelResponse } from '@vercel/node';
import { updateCompanyMember } from '../../server/services/companyMembersService.js';
import type { CompanyMemberStatus } from '../../server/db/types.js';
import { withAdminMongoApi } from '../../server/utils/apiHttp.js';
import { logger } from '../../server/utils/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  return withAdminMongoApi(req, res, {
    endpoint: '/api/company-members/:id',
    handler: async ({ companyId, requestId, params }) => {
      const id = params.id;
      if (!id) {
        return { status: 400, body: { message: 'ID do membro é obrigatório.', code: 'MISSING_ID' } };
      }

      const body = (req.body ?? {}) as {
        name?: string;
        email?: string;
        role?: string;
        status?: CompanyMemberStatus;
        position?: string;
      };
      const member = await updateCompanyMember(companyId, id, body);
      logger.info('company member updated', {
        requestId,
        companyId,
        resource: 'company_members',
        id,
      });
      return { member };
    },
  });
}
