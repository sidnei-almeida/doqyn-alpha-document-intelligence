import type { VercelRequest, VercelResponse } from '@vercel/node';
import { rejectLegacyAuthEndpoint } from '../../server/auth/legacyAuthGuard.js';
import { resolveTargetCompanyId } from '../../server/auth/memberAuth.js';
import { inviteCompanyMember } from '../../server/services/userManagementService.js';
import { withUserManagementApi } from '../../server/utils/userManagementApi.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  if (rejectLegacyAuthEndpoint(res, 'membership_invite')) {
    return;
  }

  return withUserManagementApi(req, res, {
    endpoint: '/api/company-members/invite',
    resolveCompanyId: (ctx) => {
      const body = (req.body ?? {}) as { companyId?: string };
      return resolveTargetCompanyId(ctx.user, body.companyId);
    },
    handler: async ({ user, companyId }) => {
      const body = (req.body ?? {}) as {
        email?: string;
        firstName?: string;
        lastName?: string;
        platformRoles?: string[];
        accessGroupIds?: string[];
      };

      return inviteCompanyMember(user, {
        companyId,
        email: body.email ?? '',
        firstName: body.firstName ?? '',
        lastName: body.lastName ?? '',
        platformRoles: body.platformRoles ?? ['user'],
        accessGroupIds: body.accessGroupIds ?? [],
      });
    },
  });
}
