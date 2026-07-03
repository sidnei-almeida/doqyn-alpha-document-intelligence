import type { MongoCompanyMember, MongoTenantMember } from '../db/types.js';
import {
  getMemberAccessGroupIds,
  getMemberPlatformRoles,
} from '../auth/memberAuth.js';

function serializeRequestedAccess(member: MongoTenantMember) {
  const requested = member.requestedAccess;
  if (!requested) return undefined;

  return {
    ...requested,
    requestedAt: requested.requestedAt.toISOString(),
  };
}

function serializeApprovedAccess(member: MongoTenantMember) {
  const approved = member.approvedAccess;
  if (!approved) return undefined;

  return {
    ...approved,
    approvedAt: approved.approvedAt?.toISOString(),
  };
}

export function serializeTenantMember(member: MongoTenantMember) {
  const tenantRoles = member.tenantRoles?.length ? member.tenantRoles : getMemberPlatformRoles(member as unknown as MongoCompanyMember);
  const accessGroupIds = member.accessGroupIds?.length
    ? member.accessGroupIds
    : getMemberAccessGroupIds(member as unknown as MongoCompanyMember);

  return {
    id: member._id,
    memberId: member.memberId,
    companyId: member.tenantId,
    tenantId: member.tenantId,
    userId: member.keycloakUserId ?? member.memberId,
    keycloakUserId: member.keycloakUserId,
    username: member.username,
    email: member.email,
    firstName: member.firstName,
    lastName: member.lastName,
    name: [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email,
    whatsapp: member.whatsapp,
    platformRoles: tenantRoles,
    tenantRoles,
    status: member.status,
    groupIds: accessGroupIds,
    accessGroupIds,
    requestedAccess: serializeRequestedAccess(member),
    approvedAccess: serializeApprovedAccess(member),
    notificationPreferences: member.notificationPreferences,
    consent: member.consent
      ? {
          textVersion: member.consent.consentTextVersion,
          acceptedAt: member.consent.acceptedAt?.toISOString(),
          operationalNotificationsConsent: member.consent.operationalNotifications,
        }
      : undefined,
    requestedCompanyId: member.requestedTenantId ?? member.requestedAccess?.tenantId,
    invitedBy: member.invitedBy,
    approvedBy: member.approvedBy,
    approvedAt: member.approvedAt?.toISOString(),
    rejectedBy: member.rejectedBy,
    rejectedAt: member.rejectedAt?.toISOString(),
    rejectedReason: member.rejectedReason,
    blockedBy: member.blockedBy,
    blockedAt: member.blockedAt?.toISOString(),
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
  };
}

export function serializeCompanyMember(member: MongoCompanyMember) {
  const platformRoles = getMemberPlatformRoles(member);
  const accessGroupIds = getMemberAccessGroupIds(member);

  return {
    id: member._id,
    companyId: member.companyId,
    tenantId: member.tenantId ?? member.companyId,
    userId: member.userId,
    keycloakUserId: member.keycloakUserId,
    username: member.username,
    email: member.email,
    firstName: member.firstName,
    lastName: member.lastName,
    name: member.name,
    position: member.position,
    role: member.role,
    platformRoles,
    tenantRoles: platformRoles,
    status: member.status,
    groupIds: accessGroupIds,
    accessGroupIds,
    requestedCompanyId: member.requestedCompanyId,
    invitedBy: member.invitedBy,
    approvedBy: member.approvedBy,
    approvedAt: member.approvedAt?.toISOString(),
    rejectedBy: member.rejectedBy,
    rejectedAt: member.rejectedAt?.toISOString(),
    blockedBy: member.blockedBy,
    blockedAt: member.blockedAt?.toISOString(),
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
  };
}
