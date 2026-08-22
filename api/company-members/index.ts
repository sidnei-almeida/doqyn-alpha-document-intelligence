import type { VercelRequest, VercelResponse } from '@vercel/node';
import { userCanManageUsers } from '../../server/auth/memberAuth.js';
import { listGovernanceMembers } from '../../server/services/governanceMembersService.js';
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

        // O tenant vem sempre da sessão. O ramo que lia `?companyId=` existia só para o papel
        // global de plataforma listar membro de empresa alheia; sem esse papel, não há caminho
        // cross-tenant aqui.
        const members = await listGovernanceMembers(req, user, companyId);
        logger.info('tenant members listed', {
          requestId,
          companyId,
          resource: 'tenant_members',
          count: members.length,
        });
        return { members, companyId };
      },
    });
  }

  return res.status(405).json({ message: 'Método não permitido' });
}
