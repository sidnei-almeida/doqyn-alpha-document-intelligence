import type { VercelRequest, VercelResponse } from '@vercel/node';
import { updateMemberAccess } from '../../server/services/userManagementService.js';
import { withUserManagementApi } from '../../server/utils/userManagementApi.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  return withUserManagementApi(req, res, {
    endpoint: '/api/company-members/:memberId/access',
    handler: async ({ user, params }) => {
      const memberId = params.memberId ?? params.id;
      const body = (req.body ?? {}) as {
        platformRoles?: string[];
        tenantRoles?: string[];
        accessGroupIds?: string[];
        notificationPreferences?: Record<string, boolean>;
      };

      return updateMemberAccess(user, memberId, {
        platformRoles: body.platformRoles,
        tenantRoles: body.tenantRoles,
        accessGroupIds: body.accessGroupIds ?? [],
        notificationPreferences: body.notificationPreferences,
      });
    },
  });
}
