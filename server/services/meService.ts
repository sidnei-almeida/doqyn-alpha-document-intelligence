import type { AuthUser } from '../auth/types.js';
import type { VerifiedKeycloakAuth } from '../auth/keycloakJwtVerifier.js';
import { mapMemberToAuthUser } from '../auth/memberAuth.js';
import { getTenantIdFromUser } from '../auth/tenantContext.js';
import { getTenantById } from './tenantsService.js';
import {
  findActiveTenantMember,
  findTenantMemberByIdentity,
  getMemberAccessGroups,
  getTenantRoles,
} from './tenantMembersService.js';
import { ServiceError } from '../utils/serviceErrors.js';

export type MeResponse = {
  user: {
    keycloakUserId?: string;
    email: string;
    username?: string;
    firstName?: string;
    lastName?: string;
  };
  tenant: {
    tenantId: string;
    tenantType: string;
    taxIdType: string;
    displayName: string;
    status: string;
    taxIdMasked?: string;
  };
  membership: {
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
