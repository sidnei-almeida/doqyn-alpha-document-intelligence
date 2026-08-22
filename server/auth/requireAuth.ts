import type { VercelRequest, VercelResponse } from '@vercel/node';
import { usesDoqynAuth } from './authConfig.js';
import { getSessionFromRequest } from './session.js';
import {
  mapDoqynSessionToAuthUser,
  verifyDoqynAuthSession,
} from './providers/doqynAuthProvider.js';
import type { AuthUser } from './types.js';
import { logger } from '../utils/logger.js';
import { isServiceError } from '../utils/serviceErrors.js';

export async function requireAuth(req: VercelRequest, res: VercelResponse): Promise<AuthUser | null> {
  if (usesDoqynAuth()) {
    try {
      const session = await verifyDoqynAuthSession(req);
      if (!session) {
        res.status(401).json({ error: 'Unauthorized', code: 'INVALID_SESSION' });
        return null;
      }

      if (!session.activeMembership) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Nenhuma membership ativa selecionada.',
          code: 'NO_ACTIVE_MEMBERSHIP',
        });
        return null;
      }

      const user = mapDoqynSessionToAuthUser(session);
      (req as VercelRequest & { auth?: AuthUser }).auth = user;
      return user;
    } catch (error) {
      if (isServiceError(error)) {
        res.status(error.statusCode).json({
          error: error.statusCode === 403 ? 'Forbidden' : 'Unauthorized',
          message: error.message,
          code: error.code,
        });
        return null;
      }

      logger.warn('doqyn_auth session verify failed', {
        message: error instanceof Error ? error.message : 'unknown',
      });
      res.status(502).json({
        error: 'Bad Gateway',
        message: 'Não foi possível validar a sessão no auth-service.',
        code: 'AUTH_SERVICE_UNAVAILABLE',
      });
      return null;
    }
  }

  const user = await getSessionFromRequest(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  (req as VercelRequest & { auth?: AuthUser }).auth = user;
  return user;
}

export function requireAnyRole(user: AuthUser, roles: string[], res: VercelResponse): boolean {
  const userRoles = new Set<string>(user.platformRoles ?? []);
  const ok = roles.some((role) => userRoles.has(role));
  if (!ok) {
    res.status(403).json({
      message: 'Sem permissão para esta operação.',
      code: 'FORBIDDEN',
    });
    return false;
  }
  return true;
}

export function requireRole(user: AuthUser, role: string, res: VercelResponse): boolean {
  return requireAnyRole(user, [role], res);
}

/**
 * Gestão de usuários é operação **do tenant**, exercida pelo `company_admin` sobre a própria
 * empresa. O papel global de plataforma estava nesta lista só para dar conveniência durante o
 * desenvolvimento; com ele removido, quem não é `company_admin` toma 403 aqui.
 */
export function requireUserManager(user: AuthUser, res: VercelResponse): boolean {
  return requireAnyRole(user, ['company_admin'], res);
}

export function userHasGroup(user: { groups: string[] }, group: string) {
  return user.groups.includes(group);
}

export function userHasAnyGroup(user: { groups: string[] }, groups: string[]) {
  return groups.some((group) => user.groups.includes(group));
}
