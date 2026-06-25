import type { VercelRequest, VercelResponse } from '@vercel/node';
import { activateCompanyMember } from '../../server/services/userManagementService.js';
import { withUserManagementApi } from '../../server/utils/userManagementApi.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  return withUserManagementApi(req, res, {
    endpoint: '/api/company-members/:memberId/activate',
    handler: async ({ user, params }) => {
      const memberId = params.memberId ?? params.id;
      return activateCompanyMember(user, memberId);
    },
  });
}
