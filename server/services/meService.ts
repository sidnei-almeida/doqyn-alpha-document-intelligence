import type { AuthUser } from '../auth/types.js';
import { getTenantIdFromUser } from '../auth/tenantContext.js';
import type { DoqynVerifiedSession } from '../auth/providers/doqynAuthProvider.js';
import { getTenantById } from './tenantsService.js';
import {
  findActiveTenantMember,
  getMemberAccessGroups,
  getTenantRoles,
} from './tenantMembersService.js';
import { ServiceError } from '../utils/serviceErrors.js';

export type MeResponse = {
  ok?: boolean;
  authProvider?: string;
  user: {
    id?: string;
    email: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    status?: string;
  };
  tenant: {
    tenantId: string;
    tenantType: string;
    taxIdType?: string;
    displayName: string;
    status: string;
    taxIdMasked?: string;
  };
  membership: {
    membershipId?: string;
    status: string;
    tenantRoles: string[];
    accessGroupIds: string[];
  };
  /** Compatibilidade temporária com clientes que ainda leem user plano */
  legacyUser?: AuthUser;
};

export async function resolveMeResponse(user: AuthUser): Promise<MeResponse> {
  const tenantId = getTenantIdFromUser(user);
  const tenant = await getTenantById(tenantId);

  if (!tenant) {
    throw new ServiceError('Cliente não encontrado para o usuário autenticado.', 'TENANT_NOT_FOUND', 404);
  }

  const membership = await findActiveTenantMember({
    email: user.email,
  });

  const tenantRoles = membership ? getTenantRoles(membership) : (user.platformRoles ?? ['user']);
  const accessGroupIds = membership ? getMemberAccessGroups(membership) : (user.groups ?? []);

  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName ?? membership?.firstName,
      lastName: user.lastName ?? membership?.lastName,
    },
    tenant: {
      tenantId: tenant.tenantId,
      tenantType: tenant.tenantType,
      taxIdType: tenant.taxIdType,
      displayName: tenant.displayName,
      status: tenant.status,
      taxIdMasked: tenant.taxIdMasked,
    },
    membership: {
      membershipId: membership?.memberId,
      status: membership?.status ?? 'active',
      tenantRoles: [...tenantRoles],
      accessGroupIds,
    },
    legacyUser: user,
  };
}

export function resolveMeFromDoqynAuth(session: DoqynVerifiedSession): MeResponse {
  const { user, activeMembership } = session;

  if (!activeMembership) {
    throw new ServiceError(
      'Nenhuma membership ativa selecionada.',
      'NO_ACTIVE_MEMBERSHIP',
      403,
    );
  }

  return {
    ok: true,
    authProvider: 'doqyn_auth',
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      status: user.status,
    },
    tenant: {
      tenantId: activeMembership.tenantId,
      tenantType: activeMembership.tenantType,
      displayName: activeMembership.tenantDisplayName ?? activeMembership.tenantId,
      status: 'active',
    },
    membership: {
      membershipId: activeMembership.membershipId,
      status: activeMembership.status,
      tenantRoles: [...activeMembership.roles],
      accessGroupIds: [...activeMembership.accessGroupIds],
    },
    legacyUser: {
      id: user.id,
      email: user.email,
      name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      companyId: activeMembership.tenantId,
      tenantId: activeMembership.tenantId,
      companyName: activeMembership.tenantDisplayName ?? activeMembership.tenantId,
      role: activeMembership.roles.includes('doqyn_admin')
        ? 'admin'
        : activeMembership.roles.includes('company_admin')
          ? 'manager'
          : 'user',
      area: '',
      groups: activeMembership.accessGroupIds,
      memberId: activeMembership.membershipId,
      membershipId: activeMembership.membershipId,
      platformRoles: activeMembership.roles,
      membershipStatus: activeMembership.status,
      tenantType: activeMembership.tenantType,
      authProvider: 'doqyn_auth',
    },
  };
}
