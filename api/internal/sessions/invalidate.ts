import type { VercelRequest, VercelResponse } from '@vercel/node';
import { assertAppInternalApiKey } from '../../../server/auth/requireAppInternalApiKey.js';
import { invalidateCachedDoqynSessionsForUser } from '../../../server/auth/sessionCache.js';
import { isServiceError } from '../../../server/utils/serviceErrors.js';

/**
 * Chamado pelo `doqyn-auth-service` depois de revogar sessões (logout, reset de senha, bloqueio,
 * remoção de membro, desativação). Apaga o cache de sessão dos usuários afetados, para que o cookie
 * revogado deixe de valer aqui já na próxima requisição, e não só quando o TTL vencer.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Método não permitido' });
  }

  try {
    assertAppInternalApiKey(req);

    const body = (req.body ?? {}) as { userIds?: unknown };
    const userIds = Array.isArray(body.userIds)
      ? body.userIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      : [];

    if (userIds.length === 0 || userIds.length > 1000) {
      return res.status(400).json({
        ok: false,
        message: 'userIds deve ter entre 1 e 1000 itens.',
        code: 'INVALID_USER_IDS',
      });
    }

    let invalidated = 0;
    for (const userId of new Set(userIds)) {
      invalidated += await invalidateCachedDoqynSessionsForUser(userId);
    }

    return res.status(200).json({ ok: true, invalidated });
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({
        ok: false,
        message: error.message,
        code: error.code,
      });
    }
    throw error;
  }
}
