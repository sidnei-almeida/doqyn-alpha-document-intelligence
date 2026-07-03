import type { VercelRequest, VercelResponse } from '@vercel/node';
import { approveMembershipDecision } from '../../server/services/membershipDecisionService.js';
import { withUserManagementApi } from '../../server/utils/userManagementApi.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  return withUserManagementApi(req, res, {
    endpoint: '/api/company-members/:memberId/approve',
    handler: async ({ user, params }) => {
      const memberId = params.memberId ?? params.id;
      const body = (req.body ?? {}) as {
        platformRoles?: string[];
        tenantRoles?: string[];
        accessGroupIds?: string[];
        documentGroupIds?: string[];
        notificationPreferences?: Record<string, boolean>;
      };

      return approveMembershipDecision(req, user, memberId, {
        platformRoles: body.platformRoles,
        tenantRoles: body.tenantRoles,
        accessGroupIds: body.accessGroupIds ?? [],
        documentGroupIds: body.documentGroupIds ?? [],
        notificationPreferences: body.notificationPreferences,
      });
    },
  });
}
