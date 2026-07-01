import type { AuthUser } from '../auth/types.js';
import {
  assertCanManageCompany,
  resolveTargetCompanyId,
  sanitizeAssignablePlatformRoles,
  userIsDoqynAdmin,
} from '../auth/memberAuth.js';
import type { MongoTenantMember, NotificationPreferences, PlatformRole } from '../db/types.js';
import { assertGroupIdsExist } from '../utils/groupValidation.js';
import { ServiceError } from '../utils/serviceErrors.js';
import { sanitizeRejectionReason, maskEmail } from '../utils/maskSensitiveData.js';
import { sanitizeAuditMetadata } from '../utils/sanitizeAuditMetadata.js';
import { assertActiveTenant } from './tenantsService.js';
import { createUserAuditLog } from './userAuditService.js';
import { serializeTenantMember } from './memberSerialize.js';
import {
  createUniqueMemberId,
  findTenantMemberByEmailInTenant,
  getTenantMemberById,
  listTenantMembers,
  saveTenantMember,
  updateTenantMemberFields,
} from './tenantMemberRepository.js';
import { mergeNotificationPreferences } from './accessRequestService.js';

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

  const member: MongoTenantMember = {
    _id: id,
    memberId: id,
    tenantId,
    companyId: tenantId,
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
    temporaryPassword: undefined,
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

  const now = new Date();
  const updated = await updateTenantMemberFields(memberId, tenantId, {
    status: 'active',
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
    temporaryPassword: undefined,
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

  let sanitizedReason: string;
  try {
    sanitizedReason = sanitizeRejectionReason(input?.reason);
  } catch {
    throw new ServiceError('Informe o motivo da rejeição.', 'REJECTION_REASON_REQUIRED', 400);
  }

  const now = new Date();
  const updated = await updateTenantMemberFields(memberId, tenantId, {
    status: 'rejected',
    rejectedBy: actor.memberId ?? actor.id,
    rejectedAt: now,
    rejectedReason: sanitizedReason,
  });

  await createUserAuditLog({
    tenantId,
    actor,
    action: 'USER_REJECTED',
    description: 'Solicitação de acesso rejeitada.',
    memberId,
    metadata: sanitizeAuditMetadata({
      targetMembershipId: memberId,
      targetEmailMasked: maskEmail(member.email),
      reason: sanitizedReason,
    }),
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
