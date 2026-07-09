import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../../server/auth/requireAuth.js';
import { parseMultipart } from '../../server/utils/parseMultipart.js';
import {
  readProfileAvatarBytes,
  removeProfileAvatar,
  uploadProfileAvatar,
} from '../../server/services/profile/profileAvatarService.js';
import { emitTrackingEvent } from '../../server/services/tracking/trackingService.js';
import { isServiceError } from '../../server/utils/serviceErrors.js';

function setAvatarCacheHeaders(
  res: VercelResponse,
  etag?: string,
): void {
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.setHeader('Vary', 'Cookie, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (etag) res.setHeader('ETag', etag);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireAuth(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    try {
      const sizeRaw = typeof req.query.size === 'string' ? Number.parseInt(req.query.size, 10) : undefined;
      const versionRaw = typeof req.query.v === 'string' ? Number.parseInt(req.query.v, 10) : undefined;
      const file = await readProfileAvatarBytes({
        userId: user.id,
        size: Number.isFinite(sizeRaw) ? sizeRaw : undefined,
        version: Number.isFinite(versionRaw) ? versionRaw : undefined,
      });

      if (req.headers['if-none-match'] === file.etag) {
        setAvatarCacheHeaders(res, file.etag);
        return res.status(304).end();
      }

      setAvatarCacheHeaders(res, file.etag);
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

  if (req.method === 'POST') {
    try {
      const { file } = await parseMultipart(req);
      if (!file) {
        return res.status(400).json({ message: 'Campo avatar é obrigatório.', code: 'AVATAR_MISSING' });
      }

      const profile = await uploadProfileAvatar({
        user,
        buffer: file.buffer,
        mimeType: file.mimeType,
        originalFileName: file.filename,
        req,
      });

      return res.status(200).json({ profile });
    } catch (error) {
      if (isServiceError(error)) {
        const auditCtx = {
          tenantId: user.tenantId ?? user.companyId,
          tenantType: user.tenantType === 'individual' ? ('individual' as const) : ('business' as const),
          collectionPrefix: user.tenantId ?? user.companyId,
          ownerUserId: user.id,
          actorUserId: user.id,
          actorMembershipId: user.membershipId ?? user.memberId,
          actorRoles: user.platformRoles,
          actorDisplayName: user.name,
          actorEmail: user.email,
          actorRole: user.role,
        };
        await emitTrackingEvent(auditCtx, {
          action: 'user.avatar_upload_failed',
          description: 'Falha no upload de avatar.',
          metadata: {
            reason: error.message,
            code: error.code,
          },
        }, req).catch(() => undefined);

        return res.status(error.statusCode).json({ message: error.message, code: error.code });
      }
      throw error;
    }
  }

  if (req.method === 'DELETE') {
    try {
      const profile = await removeProfileAvatar({ user, req });
      return res.status(200).json({ profile });
    } catch (error) {
      if (isServiceError(error)) {
        return res.status(error.statusCode).json({ message: error.message, code: error.code });
      }
      throw error;
    }
  }

  return res.status(405).json({ message: 'Método não permitido' });
}
