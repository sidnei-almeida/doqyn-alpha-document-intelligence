import type { AuthUser } from './types.js';
import { userIsDoqynAdmin } from './memberAuth.js';
import { isDocumentAdmin } from '../tenancy/documentAccess.js';
import { ServiceError } from '../utils/serviceErrors.js';

/** Qualquer usuário autenticado pode solicitar análise experimental. */
export function canAnalyzeDocuments(user: AuthUser): boolean {
  return Boolean(user.id);
}

/** Somente administradores confirmam metadados diretamente; demais usuários enviam para aprovação. */
export function canConfirmDocuments(
  user: AuthUser,
  _updateGroupIds: string[] = [],
): boolean {
  return isDocumentAdmin(user);
}

const TRACKING_ADMIN_ROLES = new Set(['doqyn_admin', 'company_admin', 'individual_admin']);

function hasActiveMembership(user: AuthUser): boolean {
  const status = user.membershipStatus?.trim().toLowerCase();
  if (!status) return true;
  return status === 'active';
}

/**
 * Tracking documental completo — restrito a administradores do tenant.
 * Usuário comum não deve ver trilha auditável detalhada.
 */
export function canViewDocumentTracking(user: AuthUser): boolean {
  if (!user.id?.trim()) return false;
  if (!hasActiveMembership(user)) return false;

  const roles = user.platformRoles ?? [];
  if (roles.some((role) => TRACKING_ADMIN_ROLES.has(role))) {
    return true;
  }

  return user.role === 'admin' || user.role === 'manager';
}

export function assertTrackingTenantScope(user: AuthUser, sessionTenantId: string, queryTenantId?: string): void {
  if (queryTenantId?.trim() && queryTenantId.trim() !== sessionTenantId) {
    if (!userIsDoqynAdmin(user)) {
      throw new ServiceError(
        'Tenant da requisição não corresponde à sessão.',
        'TENANT_SCOPE_FORBIDDEN',
        403,
      );
    }
  }
}
