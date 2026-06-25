import type { AuthUser } from '../auth/types.js';
import type { VerifiedKeycloakAuth } from '../auth/keycloakJwtVerifier.js';
import { mapMemberToAuthUser } from '../auth/memberAuth.js';
import { getTenantIdFromUser } from '../auth/tenantContext.js';
import type { DoqynVerifiedSession } from '../auth/providers/doqynAuthProvider.js';
import { getTenantById } from './tenantsService.js';
import {
  findActiveTenantMember,
  findTenantMemberByIdentity,
  getMemberAccessGroups,
  getTenantRoles,
} from './tenantMembersService.js';
import { ServiceError } from '../utils/serviceErrors.js';

export type MeResponse = {
  ok?: boolean;
  authProvider?: string;
  user: {
    id?: string;
    keycloakUserId?: string;
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

export async function resolveMeResponse(
  user: AuthUser,
  keycloak?: VerifiedKeycloakAuth,
): Promise<MeResponse> {
  const tenantId = getTenantIdFromUser(user);
  const tenant = await getTenantById(tenantId);

  if (!tenant) {
    throw new ServiceError('Cliente não encontrado para o usuário autenticado.', 'TENANT_NOT_FOUND', 404);
  }

  const membership =
    keycloak &&
    (await findActiveTenantMember({
      keycloakUserId: keycloak.keycloakUserId,
      email: keycloak.email,
    }));

  const tenantRoles = membership ? getTenantRoles(membership) : (user.platformRoles ?? ['user']);
  const accessGroupIds = membership ? getMemberAccessGroups(membership) : (user.groups ?? []);

  return {
    user: {
      keycloakUserId: user.keycloakUserId ?? keycloak?.keycloakUserId,
      email: user.email,
      username: user.username ?? keycloak?.username,
      firstName: keycloak?.firstName ?? membership?.firstName,
      lastName: keycloak?.lastName ?? membership?.lastName,
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
      status: membership?.status ?? 'active',
      tenantRoles: [...tenantRoles],
      accessGroupIds,
    },
    legacyUser: user,
  };
}

export async function resolveMeFromKeycloakClaims(
  claims: VerifiedKeycloakAuth,
): Promise<MeResponse> {
  const membership = await findTenantMemberByIdentity({
    keycloakUserId: claims.keycloakUserId,
    email: claims.email,
  });

  if (!membership) {
    throw new ServiceError(
      'Seu usuário ainda não está vinculado a um cliente ativo no DOQYN.',
      'MEMBER_NOT_LINKED',
      403,
    );
  }

  const tenant = await getTenantById(membership.tenantId);
  if (!tenant) {
    throw new ServiceError('Cliente não encontrado.', 'TENANT_NOT_FOUND', 404);
  }

  const authUser = mapMemberToAuthUser(
    {
      _id: membership.memberId,
      tenantId: membership.tenantId,
      companyId: membership.tenantId,
      userId: membership.keycloakUserId ?? membership.memberId,
      name: [membership.firstName, membership.lastName].filter(Boolean).join(' ') || membership.email,
      email: membership.email,
      firstName: membership.firstName,
      lastName: membership.lastName,
      username: membership.username,
      keycloakUserId: membership.keycloakUserId,
      role: 'member',
      platformRoles: membership.tenantRoles,
      status: membership.status,
      groupIds: membership.accessGroupIds,
      accessGroupIds: membership.accessGroupIds,
      createdAt: membership.createdAt,
      updatedAt: membership.updatedAt,
    },
    claims,
    tenant.displayName,
  );

  return resolveMeResponse(authUser, claims);
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
