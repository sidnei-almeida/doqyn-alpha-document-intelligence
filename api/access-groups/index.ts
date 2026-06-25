import type { VercelRequest, VercelResponse } from '@vercel/node';

const DEPRECATED = {
  message:
    'Grupos de acesso são gerenciados pelo auth-service. Use /auth/admin/access-groups.',
  code: 'ACCESS_GROUPS_MONGO_DEPRECATED',
} as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET' || req.method === 'POST') {
    return res.status(410).json(DEPRECATED);
  }

  return res.status(405).json({ message: 'Método não permitido' });
}
