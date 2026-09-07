import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyDoqynAuthSession } from '../server/auth/providers/doqynAuthProvider.js';
import { resolveMeFromDoqynAuth } from '../server/services/meService.js';
import { isServiceError } from '../server/utils/serviceErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await verifyDoqynAuthSession(req);
    if (!session) {
      return res.status(401).json({
        message: 'Não autenticado.',
        code: 'INVALID_SESSION',
      });
    }

    return res.status(200).json(resolveMeFromDoqynAuth(session));
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({
        ok: false,
        message: error.message,
        code: error.code,
        ...(error.details ? { details: error.details } : {}),
        ...(error.payload ?? {}),
      });
    }
    return res.status(500).json({ message: 'Não foi possível resolver o contexto do usuário.' });
  }
}
