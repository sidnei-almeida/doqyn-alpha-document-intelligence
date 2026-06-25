import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readBearerToken, verifyKeycloakAccessToken } from '../server/auth/keycloakJwtVerifier.js';
import { requireAuth } from '../server/auth/requireAuth.js';
import { resolveMeFromKeycloakClaims, resolveMeResponse } from '../server/services/meService.js';
import { isServiceError } from '../server/utils/serviceErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const bearer = readBearerToken(req);

    if (bearer) {
      const claims = await verifyKeycloakAccessToken(bearer);
      const payload = await resolveMeFromKeycloakClaims(claims);
      return res.status(200).json(payload);
    }

    const user = await requireAuth(req, res as VercelResponse);
    if (!user) return;

    const payload = await resolveMeResponse(user);
    return res.status(200).json(payload);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    return res.status(500).json({ message: 'Não foi possível resolver o contexto do usuário.' });
  }
}
