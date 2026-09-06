import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../../server/auth/requireAuth.js';
import { buildProfileMeResponse } from '../../server/services/profile/profileAvatarService.js';
import { verifyDoqynAuthSession } from '../../server/auth/providers/doqynAuthProvider.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    const session = await verifyDoqynAuthSession(req);
    const avatarVersion = session?.user.avatarVersion ?? 0;
    const avatarUpdatedAt = session?.user.avatarUpdatedAt ?? null;
    const avatarStatus = session?.user.avatarStatus ?? null;

    return res.status(200).json(
      buildProfileMeResponse(user, {
        avatarVersion,
        avatarUpdatedAt,
        avatarStatus,
      }),
    );
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
