import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveTargetCompanyId, userCanManageUsers, userIsDoqynAdmin } from '../../server/auth/memberAuth.js';
import { listManagedTenantMembers } from '../../server/services/userManagementService.js';
import { withAdminMongoApi } from '../../server/utils/apiHttp.js';
import { logger } from '../../server/utils/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return withAdminMongoApi(req, res, {
      endpoint: '/api/company-members',
      handler: async ({ companyId, requestId, user }) => {
        if (!userCanManageUsers(user)) {
          return {
            status: 403,
            body: { message: 'Sem permissão para listar usuários.', code: 'FORBIDDEN' },
          };
        }

        const queryCompanyId =
          typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
        const effectiveCompanyId = userIsDoqynAdmin(user)
          ? resolveTargetCompanyId(user, queryCompanyId ?? companyId)
          : companyId;

        const members = await listManagedTenantMembers(user, queryCompanyId ?? companyId);
        logger.info('tenant members listed', {
          requestId,
          companyId: effectiveCompanyId,
          resource: 'tenant_members',
          count: members.length,
        });
        return { members, companyId: effectiveCompanyId };
      },
    });
  }

  return res.status(405).json({ message: 'Método não permitido' });
}
