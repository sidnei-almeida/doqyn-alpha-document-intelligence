import type { VercelRequest } from '@vercel/node';
import { DEV_TENANT_ID } from '../db/constants.js';
import { usesDoqynAuth } from './authConfig.js';
import { getDoqynSessionTokenFromRequest } from './providers/doqynAuthProvider.js';
import { getSessionFromRequest } from './session.js';
import type { AuthUser } from './types.js';
import { ServiceError } from '../utils/serviceErrors.js';

const LEGACY_TEMP_TENANT_IDS = new Set(['doqyn-alpha']);

/**
 * Resolve o tenantId efetivo para rotas autenticadas.
 * Nunca faz fallback para company_dev — tenant deve vir da sessão.
 */
export function resolveTenantId(sessionTenantId?: string): string {
  const fromSession = sessionTenantId?.trim();

  if (fromSession && !LEGACY_TEMP_TENANT_IDS.has(fromSession)) {
    return fromSession;
  }

  throw new ServiceError(
    'Não foi possível identificar a empresa/tenant ativo da sessão.',
    'TENANT_REQUIRED',
    400,
  );
}

export function getTenantIdFromUser(user: AuthUser): string {
  return resolveTenantId(user.tenantId ?? user.companyId);
}

/** @deprecated Use getTenantIdFromUser */
export function getCompanyIdFromUser(user: AuthUser): string {
  return getTenantIdFromUser(user);
}

/** @deprecated Use resolveTenantId */
export function resolveCompanyId(sessionCompanyId?: string): string {
  return resolveTenantId(sessionCompanyId);
}

export async function getCurrentTenantId(req: VercelRequest): Promise<string> {
  if (usesDoqynAuth()) {
    const token = getDoqynSessionTokenFromRequest(req);
    if (token) {
      const { verifyDoqynAuthSession } = await import('./providers/doqynAuthProvider.js');
      try {
        const session = await verifyDoqynAuthSession(req);
        if (session?.activeMembership) {
          return session.activeMembership.tenantId;
        }
      } catch {
        // continua para sessão legada
      }
    }
  }

  const user = await getSessionFromRequest(req);
  if (user) {
    return getTenantIdFromUser(user);
  }

  throw new ServiceError(
    'Não foi possível identificar a empresa/tenant ativo da sessão.',
    'TENANT_REQUIRED',
    400,
  );
}

/**
 * Somente scripts dev explícitos — nunca usar em rotas autenticadas reais.
 */
export function resolveDevScriptTenantId(): string {
  return DEV_TENANT_ID;
}

/** @deprecated Use getCurrentTenantId */
export async function getCurrentCompanyId(req: VercelRequest): Promise<string> {
  return getCurrentTenantId(req);
}
