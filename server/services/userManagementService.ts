import type { AuthUser } from '../auth/types.js';
import {
  createUser,
  disableUser,
  enableUser,
  findUserByEmail,
  generateTemporaryPassword,
  setTemporaryPassword,
  syncRealmRoles,
} from '../auth/keycloakAdminService.js';
import {
  assertCanManageCompany,
  mapMemberToAuthUser,
  resolveTargetCompanyId,
  sanitizeAssignablePlatformRoles,
  userIsDoqynAdmin,
} from '../auth/memberAuth.js';
import type { VerifiedKeycloakAuth } from '../auth/keycloakJwtVerifier.js';
import type { MongoTenantMember, NotificationPreferences, PlatformRole } from '../db/types.js';
import { assertGroupIdsExist } from '../utils/groupValidation.js';
import { ServiceError } from '../utils/serviceErrors.js';
import { requireActiveTenantMember } from './tenantMembersService.js';
import { assertActiveTenant, getTenantById } from './tenantsService.js';
import { createUserAuditLog } from './userAuditService.js';
import { serializeTenantMember } from './memberSerialize.js';
import {
  createUniqueMemberId,
  findTenantMemberByEmailInTenant,
  getTenantMemberById,
  listTenantMembers,
  saveTenantMember,
  tenantMemberToCompanyMember,
  updateTenantMemberFields,
} from './tenantMemberRepository.js';
import { mergeNotificationPreferences } from './accessRequestService.js';

const APP_ENV = process.env.APP_ENV?.trim() || process.env.NODE_ENV || 'development';

function isDevelopmentEnv(): boolean {
  return APP_ENV !== 'production';
}

async function getMemberOrThrowForActor(actor: AuthUser, memberId: string): Promise<MongoTenantMember> {
  const member = await getTenantMemberById(memberId);

  if (!member) {
    throw new ServiceError('Membro não encontrado.', 'NOT_FOUND', 404);
  }

  try {
    assertCanManageCompany(actor, member.tenantId);
  } catch {
    throw new ServiceError('Sem permissão para este membro.', 'FORBIDDEN', 403);
  }

  return member;
}

function resolvePlatformRoles(input: {
  platformRoles?: string[];
  tenantRoles?: string[];
}): PlatformRole[] {
  return (input.tenantRoles ?? input.platformRoles ?? ['user']) as PlatformRole[];
}

async function ensureKeycloakUser(input: {
  email: string;
  firstName: string;
  lastName: string;
  platformRoles: PlatformRole[];
  actor: AuthUser;
  memberId: string;
  companyId: string;
}): Promise<{ keycloakUserId: string; temporaryPassword?: string }> {
  const email = input.email.trim().toLowerCase();
  let keycloakUserId = (await findUserByEmail(email))?.id;

  if (!keycloakUserId) {
    keycloakUserId = await createUser({
      email,
      firstName: input.firstName,
      lastName: input.lastName,
      enabled: true,
    });
    await createUserAuditLog({
      companyId: input.companyId,
      actor: input.actor,
      action: 'KEYCLOAK_USER_CREATED',
      description: 'Usuário criado no Keycloak.',
      memberId: input.memberId,
      metadata: { email },
    });
  }

  const temporaryPassword = generateTemporaryPassword();
  await setTemporaryPassword(keycloakUserId, temporaryPassword);
  await syncRealmRoles(keycloakUserId, input.platformRoles);
  await createUserAuditLog({
    companyId: input.companyId,
    actor: input.actor,
    action: 'KEYCLOAK_ROLE_ASSIGNED',
    description: 'Roles globais sincronizadas no Keycloak.',
    memberId: input.memberId,
    metadata: { platformRoles: input.platformRoles },
  });

  return {
    keycloakUserId,
    temporaryPassword: isDevelopmentEnv() ? temporaryPassword : undefined,
  };
}

export async function resolveAuthUserFromKeycloak(
  claims: VerifiedKeycloakAuth,
): Promise<AuthUser> {
  const membership = await requireActiveTenantMember(claims);
  const tenant = await getTenantById(membership.tenantId);
  const legacyMember = tenantMemberToCompanyMember(membership);
  return mapMemberToAuthUser(legacyMember, claims, tenant?.displayName ?? 'DOQYN');
}

export async function listManagedTenantMembers(actor: AuthUser, requestedTenantId?: string) {
  const tenantId = resolveTargetCompanyId(actor, requestedTenantId);
  const members = await listTenantMembers(tenantId);
  return members.map(serializeTenantMember);
}

export async function inviteCompanyMember(
  actor: AuthUser,
  input: {
    companyId?: string;
    email: string;
    firstName: string;
    lastName: string;
    platformRoles: string[];
    accessGroupIds: string[];
  },
) {
  const tenantId = resolveTargetCompanyId(actor, input.companyId);
  await assertActiveTenant(tenantId);

  const email = input.email.trim().toLowerCase();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const tenantRoles = sanitizeAssignablePlatformRoles(actor, input.platformRoles);
  const accessGroupIds = input.accessGroupIds ?? [];

  await assertGroupIdsExist(tenantId, accessGroupIds, { requireActive: true });

  const duplicate = await findTenantMemberByEmailInTenant(tenantId, email, ['active', 'pending']);
  if (duplicate) {
    throw new ServiceError('Já existe membro ou solicitação com este e-mail.', 'DUPLICATE_EMAIL', 409);
  }

  const now = new Date();
  const id = await createUniqueMemberId(email, tenantId);
  const { keycloakUserId, temporaryPassword } = await ensureKeycloakUser({
    email,
    firstName,
    lastName,
    platformRoles: tenantRoles,
    actor,
    memberId: id,
    companyId: tenantId,
  });

  const member: MongoTenantMember = {
    _id: id,
    memberId: id,
    tenantId,
    companyId: tenantId,
    keycloakUserId,
    username: email,
    email,
    emailNormalized: email,
    firstName,
    lastName,
    status: 'active',
    tenantRoles,
    accessGroupIds,
    requestedAccess: {
      source: 'admin_invite',
      requestedAt: now,
    },
    invitedBy: actor.memberId ?? actor.id,
    createdAt: now,
    updatedAt: now,
  };

  await saveTenantMember(member);

  await createUserAuditLog({
    tenantId,
    actor,
    action: 'USER_INVITED',
    description: 'Usuário convidado/criado pelo administrador.',
    memberId: id,
    metadata: { email, tenantRoles },
  });

  return {
    member: serializeTenantMember(member),
    temporaryPassword,
  };
}

export async function approveCompanyMember(
  actor: AuthUser,
  memberId: string,
  input: {
    platformRoles?: string[];
    tenantRoles?: string[];
    accessGroupIds: string[];
    notificationPreferences?: Partial<NotificationPreferences>;
  },
) {
  const member = await getMemberOrThrowForActor(actor, memberId);
  const tenantId = member.tenantId;

  if (member.status !== 'pending') {
    throw new ServiceError('Somente solicitações pendentes podem ser aprovadas.', 'INVALID_STATUS', 400);
  }

  const tenantRoles = sanitizeAssignablePlatformRoles(actor, resolvePlatformRoles(input));
  const accessGroupIds = input.accessGroupIds ?? [];
  const notificationPreferences = mergeNotificationPreferences(input.notificationPreferences);

  await assertGroupIdsExist(tenantId, accessGroupIds, { requireActive: true });

  const firstName = member.firstName ?? 'Usuário';
  const lastName = member.lastName ?? 'DOQYN';

  const { keycloakUserId, temporaryPassword } = await ensureKeycloakUser({
    email: member.email,
    firstName,
    lastName,
    platformRoles: tenantRoles,
    actor,
    memberId,
    companyId: tenantId,
  });

  const now = new Date();
  const updated = await updateTenantMemberFields(memberId, tenantId, {
    status: 'active',
    keycloakUserId,
    tenantRoles,
    accessGroupIds,
    notificationPreferences,
    approvedAccess: {
      tenantRoles,
      accessGroupIds,
      approvedBy: actor.memberId ?? actor.id,
      approvedAt: now,
    },
    approvedBy: actor.memberId ?? actor.id,
    approvedAt: now,
  });

  await createUserAuditLog({
    tenantId,
    actor,
    action: 'USER_APPROVED',
    description: 'Solicitação de acesso aprovada.',
    memberId,
    metadata: { tenantRoles, accessGroupIds },
  });

  await createUserAuditLog({
    tenantId,
    actor,
    action: 'USER_ACCESS_UPDATED',
    description: 'Acesso aprovado com roles e grupos definidos.',
    memberId,
    metadata: { tenantRoles, accessGroupIds },
  });

  await createUserAuditLog({
    tenantId,
    actor,
    action: 'NOTIFICATION_PREFERENCES_UPDATED',
    description: 'Preferências de notificação definidas na aprovação.',
    memberId,
    metadata: { notificationPreferences },
  });

  return {
    member: serializeTenantMember(updated),
    temporaryPassword,
  };
}

export async function rejectCompanyMember(
  actor: AuthUser,
  memberId: string,
  input?: { reason?: string },
) {
  const member = await getMemberOrThrowForActor(actor, memberId);
  const tenantId = member.tenantId;

  if (member.status !== 'pending') {
    throw new ServiceError('Somente solicitações pendentes podem ser rejeitadas.', 'INVALID_STATUS', 400);
  }

  const now = new Date();
  const updated = await updateTenantMemberFields(memberId, tenantId, {
    status: 'rejected',
    rejectedBy: actor.memberId ?? actor.id,
    rejectedAt: now,
    rejectedReason: input?.reason?.trim() || undefined,
  });

  if (member.keycloakUserId) {
    await disableUser(member.keycloakUserId);
  }

  await createUserAuditLog({
    tenantId,
    actor,
    action: 'USER_REJECTED',
    description: 'Solicitação de acesso rejeitada.',
    memberId,
    metadata: input?.reason ? { reason: input.reason.trim() } : undefined,
  });

  return { member: serializeTenantMember(updated) };
}

export async function blockCompanyMember(actor: AuthUser, memberId: string) {
  const member = await getMemberOrThrowForActor(actor, memberId);
  const tenantId = member.tenantId;

  if (member.tenantRoles.includes('doqyn_admin') && !userIsDoqynAdmin(actor)) {
    throw new ServiceError('Você não pode bloquear um administrador global.', 'FORBIDDEN', 403);
  }

  const now = new Date();
  const updated = await updateTenantMemberFields(memberId, tenantId, {
    status: 'blocked',
    blockedBy: actor.memberId ?? actor.id,
    blockedAt: now,
  });

  if (member.keycloakUserId) {
    await disableUser(member.keycloakUserId);
    await createUserAuditLog({
      tenantId,
      actor,
      action: 'KEYCLOAK_USER_DISABLED',
      description: 'Usuário desativado no Keycloak.',
      memberId,
    });
  }

  await createUserAuditLog({
    tenantId,
    actor,
    action: 'USER_BLOCKED',
    description: 'Usuário bloqueado na empresa.',
    memberId,
  });

  return { member: serializeTenantMember(updated) };
}

export async function activateCompanyMember(actor: AuthUser, memberId: string) {
  const member = await getMemberOrThrowForActor(actor, memberId);
  const tenantId = member.tenantId;
  const now = new Date();
  const rest: MongoTenantMember = { ...member, status: 'active', updatedAt: now };
  delete rest.blockedBy;
  delete rest.blockedAt;
  const updated = await saveTenantMember(rest);

  if (member.keycloakUserId) {
    await enableUser(member.keycloakUserId);
  }

  await createUserAuditLog({
    tenantId,
    actor,
    action: 'USER_ACTIVATED',
    description: 'Usuário reativado na empresa.',
    memberId,
  });

  return { member: serializeTenantMember(updated) };
}

export async function updateMemberAccess(
  actor: AuthUser,
  memberId: string,
  input: {
    platformRoles?: string[];
    tenantRoles?: string[];
    accessGroupIds: string[];
    notificationPreferences?: Partial<NotificationPreferences>;
  },
) {
  const member = await getMemberOrThrowForActor(actor, memberId);
  const tenantId = member.tenantId;
  const tenantRoles = sanitizeAssignablePlatformRoles(actor, resolvePlatformRoles(input));
  const accessGroupIds = input.accessGroupIds ?? [];
  const notificationPreferences = input.notificationPreferences
    ? mergeNotificationPreferences(input.notificationPreferences)
    : member.notificationPreferences;

  await assertGroupIdsExist(tenantId, accessGroupIds, { requireActive: true });

  if (member.keycloakUserId) {
    await syncRealmRoles(member.keycloakUserId, tenantRoles);
  }

  const updated = await updateTenantMemberFields(memberId, tenantId, {
    tenantRoles,
    accessGroupIds,
    notificationPreferences,
  });

  await createUserAuditLog({
    tenantId,
    actor,
    action: 'USER_ACCESS_UPDATED',
    description: 'Roles globais e grupos de acesso atualizados.',
    memberId,
    metadata: { tenantRoles, accessGroupIds },
  });

  if (input.notificationPreferences) {
    await createUserAuditLog({
      tenantId,
      actor,
      action: 'NOTIFICATION_PREFERENCES_UPDATED',
      description: 'Preferências de notificação atualizadas.',
      memberId,
      metadata: { notificationPreferences },
    });
  }

  return { member: serializeTenantMember(updated) };
}
