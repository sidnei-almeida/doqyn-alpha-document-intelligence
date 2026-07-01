import type { VercelRequest, VercelResponse } from '@vercel/node';
import { rejectMembershipDecision } from '../../server/services/membershipDecisionService.js';
import { withUserManagementApi } from '../../server/utils/userManagementApi.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  return withUserManagementApi(req, res, {
    endpoint: '/api/company-members/:memberId/reject',
    handler: async ({ user, params }) => {
      const memberId = params.memberId ?? params.id;
      const body = (req.body ?? {}) as { reason?: string };
      return rejectMembershipDecision(req, user, memberId, body.reason);
    },
  });
}
