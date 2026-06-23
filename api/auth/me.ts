import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSessionFromRequest } from '../../server/auth/session.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getSessionFromRequest(req);

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return res.status(200).json({
    user,
  });
}
