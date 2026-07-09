import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../../server/auth/requireAuth.js';
import {
  assertCanViewUserAvatar,
  readProfileAvatarBytes,
} from '../../server/services/profile/profileAvatarService.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const userId =
    typeof req.query.userId === 'string'
      ? req.query.userId
      : typeof req.query.id === 'string'
        ? req.query.id
        : undefined;

  if (!userId) {
    return res.status(400).json({ message: 'userId é obrigatório.', code: 'MISSING_USER_ID' });
  }

  try {
    await assertCanViewUserAvatar({ requester: user, targetUserId: userId });

    const sizeRaw = typeof req.query.size === 'string' ? Number.parseInt(req.query.size, 10) : undefined;
    const versionRaw = typeof req.query.v === 'string' ? Number.parseInt(req.query.v, 10) : undefined;
    const file = await readProfileAvatarBytes({
      userId,
      size: Number.isFinite(sizeRaw) ? sizeRaw : undefined,
      version: Number.isFinite(versionRaw) ? versionRaw : undefined,
    });

    const etag = file.etag;
    if (req.headers['if-none-match'] === etag) {
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.setHeader('Vary', 'Cookie, Authorization');
      if (etag) res.setHeader('ETag', etag);
      return res.status(304).end();
    }

    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Vary', 'Cookie, Authorization');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (etag) res.setHeader('ETag', etag);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Length', String(file.buffer.length));
    return res.status(200).send(file.buffer);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    throw error;
  }
}
