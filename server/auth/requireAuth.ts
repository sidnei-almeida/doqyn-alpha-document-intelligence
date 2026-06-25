import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSessionFromRequest } from './session.js';
import { readBearerToken, verifyKeycloakAccessToken } from './keycloakJwtVerifier.js';
import { resolveAuthUserFromKeycloak } from '../services/userManagementService.js';
import type { AuthUser } from './types.js';
import { userIsDoqynAdmin } from './memberAuth.js';
import { logger } from '../utils/logger.js';
import { isServiceError } from '../utils/serviceErrors.js';

export async function requireAuth(req: VercelRequest, res: VercelResponse): Promise<AuthUser | null> {
  const bearer = readBearerToken(req);

  if (bearer) {
    try {
      const claims = await verifyKeycloakAccessToken(bearer);
      const user = await resolveAuthUserFromKeycloak(claims);
      (req as VercelRequest & { auth?: AuthUser }).auth = user;
      return user;
    } catch (error) {
      if (isServiceError(error)) {
        const status = error.statusCode;
        res.status(status).json({
          error: status === 403 ? 'Forbidden' : 'Unauthorized',
          message: error.message,
          code: error.code,
        });
        return null;
      }

      const message =
        error instanceof Error ? error.message : 'Token de autenticação inválido.';
      logger.warn('Bearer auth failed', {
        message,
        hasBearerToken: true,
      });
      res.status(401).json({
        error: 'Unauthorized',
        message,
        code: 'INVALID_BEARER_TOKEN',
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
  const userRoles = new Set([...(user.platformRoles ?? []), ...(user.keycloakRoles ?? [])]);
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

export function requireUserManager(user: AuthUser, res: VercelResponse): boolean {
  return requireAnyRole(user, ['doqyn_admin', 'company_admin'], res);
}

export function userHasGroup(user: { groups: string[] }, group: string) {
  return user.groups.includes(group);
}

export function userHasAnyGroup(user: { groups: string[] }, groups: string[]) {
  return groups.some((group) => user.groups.includes(group));
}

export function userHasRole(user: { role: string }, roles: string[]) {
  return roles.includes(user.role);
}

export { userIsDoqynAdmin };
