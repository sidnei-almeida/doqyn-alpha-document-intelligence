import type { VercelRequest } from '@vercel/node';
import { usesDoqynAuth } from '../auth/authConfig.js';
import {
  assertCanManageCompany,
  mapLegacyRoleFromPlatformRoles,
  resolveTargetCompanyId,
} from '../auth/memberAuth.js';
import type { AuthUser } from '../auth/types.js';
import type { TenantMemberStatus } from '../db/types.js';
import { callDoqynAuthAdmin } from '../integrations/doqynAuthAdminClient.js';
import { ServiceError } from '../utils/serviceErrors.js';
import { logger } from '../utils/logger.js';
import {
  listAllGroupMemberships,
  syncMemberDocumentGroups,
} from './documentGroupsService.js';
import { serializeTenantMember } from './memberSerialize.js';
import {
  getTenantMemberById,
  listTenantMembers,
} from './tenantMemberRepository.js';
import { syncTenantMembersFromAuth } from './tenantMemberSyncService.js';

export type GovernanceMemberRecord = {
  id: string;
  companyId: string;
  tenantId: string;
  userId: string;
  name: string;
  email: string;
  firstName?: string;
  lastName?: string;
  whatsapp?: string;
  position?: string;
  role: string;
  platformRoles: string[];
  status: TenantMemberStatus;
  accessGroupIds: string[];
  groupIds: string[];
  documentGroupIds: string[];
  requestedAccess?: {
    personType?: 'individual' | 'business';
    taxIdType?: 'CPF' | 'CNPJ';
    taxIdMasked?: string;
    tenantDisplayName?: string;
    jobTitle?: string;
    departmentText?: string;
    reason?: string;
    requestedAt: string;
    source?: string;
  };
  consent?: {
    textVersion?: string;
    acceptedAt?: string;
    operationalNotificationsConsent?: boolean;
  };
  notificationPreferences?: ReturnType<typeof serializeTenantMember>['notificationPreferences'];
  createdAt: string;
  updatedAt: string;
};

type AuthMembershipItem = {
  membershipId: string;
  tenantId: string;
  status: TenantMemberStatus | 'removed';
  roles: string[];
  accessGroupIds: string[];
};

type AuthMemberDetail = {
  user: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    whatsapp?: string | null;
  };
  membership: AuthMembershipItem;
  tenant?: {
    tenantId: string;
    displayName: string | null;
  };
  requestedAccess?: {
    personType: string;
    taxIdType?: string;
    taxIdMasked?: string | null;
    tenantDisplayName?: string | null;
    jobTitle?: string | null;
    departmentText?: string | null;
    reason?: string | null;
    requestedAt?: string;
    source?: string;
  };
  consent?: {
    textVersion?: string | null;
    acceptedAt?: string;
    operationalNotificationsConsent?: boolean;
  };
  notificationPreferences?: GovernanceMemberRecord['notificationPreferences'];
  createdAt: string;
  updatedAt: string;
};

function buildDocumentGroupMap(
  memberships: Awaited<ReturnType<typeof listAllGroupMemberships>>,
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const row of memberships) {
    const current = map.get(row.membershipId) ?? [];
    if (!current.includes(row.groupId)) {
      current.push(row.groupId);
    }
    map.set(row.membershipId, current);
  }
  return map;
}

function mapAuthDetailToGovernanceMember(
  detail: AuthMemberDetail,
  documentGroupIds: string[],
): GovernanceMemberRecord {
  const { user, membership, requestedAccess, consent, notificationPreferences } = detail;
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
  const roles = membership.roles as Parameters<typeof mapLegacyRoleFromPlatformRoles>[0];

  return {
    id: membership.membershipId,
    companyId: membership.tenantId,
    tenantId: membership.tenantId,
    userId: user.id,
    name,
    email: user.email,
    firstName: user.firstName ?? undefined,
    lastName: user.lastName ?? undefined,
    whatsapp: user.whatsapp ?? undefined,
    role: mapLegacyRoleFromPlatformRoles(roles),
    platformRoles: membership.roles ?? [],
    status: membership.status === 'removed' ? 'rejected' : membership.status,
    accessGroupIds: membership.accessGroupIds ?? [],
    groupIds: documentGroupIds,
    documentGroupIds,
    requestedAccess: requestedAccess
      ? {
          personType:
            requestedAccess.personType === 'individual' || requestedAccess.personType === 'business'
              ? requestedAccess.personType
              : undefined,
          taxIdType:
            requestedAccess.taxIdType?.toUpperCase() === 'CPF'
              ? 'CPF'
              : requestedAccess.taxIdType?.toUpperCase() === 'CNPJ'
                ? 'CNPJ'
                : undefined,
          taxIdMasked: requestedAccess.taxIdMasked ?? undefined,
          tenantDisplayName: requestedAccess.tenantDisplayName ?? undefined,
          jobTitle: requestedAccess.jobTitle ?? undefined,
          departmentText: requestedAccess.departmentText ?? undefined,
          reason: requestedAccess.reason ?? undefined,
          requestedAt: requestedAccess.requestedAt ?? detail.createdAt,
          source: requestedAccess.source,
        }
      : undefined,
    consent: consent
      ? {
          textVersion: consent.textVersion ?? undefined,
          acceptedAt: consent.acceptedAt,
          operationalNotificationsConsent: consent.operationalNotificationsConsent,
        }
      : undefined,
    notificationPreferences,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
  };
}

function mapMongoMemberToGovernanceMember(
  serialized: ReturnType<typeof serializeTenantMember>,
  documentGroupIds: string[],
  userId: string,
): GovernanceMemberRecord {
  return {
    id: serialized.id,
    companyId: serialized.companyId,
    tenantId: serialized.tenantId,
    userId,
    name: serialized.name,
    email: serialized.email,
    firstName: serialized.firstName,
    lastName: serialized.lastName,
    whatsapp: serialized.whatsapp,
    position: undefined,
    role: mapLegacyRoleFromPlatformRoles(serialized.platformRoles),
    platformRoles: serialized.platformRoles,
    status: serialized.status,
    accessGroupIds: serialized.accessGroupIds,
    groupIds: documentGroupIds,
    documentGroupIds,
    requestedAccess: serialized.requestedAccess
      ? {
          ...serialized.requestedAccess,
          taxIdType:
            serialized.requestedAccess.taxIdType?.toUpperCase() === 'CPF'
              ? 'CPF'
              : serialized.requestedAccess.taxIdType?.toUpperCase() === 'CNPJ'
                ? 'CNPJ'
                : undefined,
        }
      : undefined,
    consent: serialized.consent,
    notificationPreferences: serialized.notificationPreferences,
    createdAt: serialized.createdAt,
    updatedAt: serialized.updatedAt,
  };
}

async function listAuthGovernanceMembers(
  req: VercelRequest,
  tenantId: string,
  documentGroupMap: Map<string, string[]>,
): Promise<GovernanceMemberRecord[]> {
  const listResult = await callDoqynAuthAdmin<{
    items: AuthMembershipItem[];
  }>(req, '/auth/admin/members', {
    query: { tenantId, limit: '100' },
  });

  const items = listResult.items ?? [];
  const details: GovernanceMemberRecord[] = [];

  for (const item of items) {
    try {
      const detail = await callDoqynAuthAdmin<{ member: AuthMemberDetail }>(
        req,
        `/auth/admin/members/${item.membershipId}`,
        { query: { tenantId } },
      );
      details.push(
        mapAuthDetailToGovernanceMember(
          detail.member,
          documentGroupMap.get(item.membershipId) ?? [],
        ),
      );
    } catch {
      // Ignora falha pontual de detalhe; demais membros continuam listáveis.
    }
  }

  return details;
}

export async function listGovernanceMembers(
  req: VercelRequest,
  actor: AuthUser,
  requestedTenantId?: string,
): Promise<GovernanceMemberRecord[]> {
  const tenantId = resolveTargetCompanyId(actor, requestedTenantId);
  assertCanManageCompany(actor, tenantId);

  const documentGroupMap = buildDocumentGroupMap(
    await listAllGroupMemberships(tenantId, { ownerUserId: actor.id }),
  );

  if (usesDoqynAuth()) {
    const members = await listAuthGovernanceMembers(req, tenantId, documentGroupMap);
    try {
      await syncTenantMembersFromAuth(tenantId);
    } catch {
      // Listagem admin continua mesmo se o espelhamento falhar pontualmente.
    }
    logger.info('governance members listed', {
      tenantId,
      memberCount: members.length,
      accessGroupsInTenant: new Set(members.flatMap((m) => m.accessGroupIds)).size,
      documentGroupsInTenant: new Set(members.flatMap((m) => m.documentGroupIds)).size,
    });
    return members;
  }

  const mongoMembers = await listTenantMembers(tenantId);
  return mongoMembers.map((member) => {
    const serialized = serializeTenantMember(member);
    const documentGroupIds = documentGroupMap.get(member._id) ?? [];
    const userId = member.authUserId ?? member.memberId ?? member._id;
    return mapMongoMemberToGovernanceMember(serialized, documentGroupIds, userId);
  });
}

export async function resolveGovernanceMemberIdentity(
  req: VercelRequest,
  actor: AuthUser,
  tenantId: string,
  membershipId: string,
): Promise<{ userId: string; displayName: string; email: string }> {
  assertCanManageCompany(actor, tenantId);

  if (usesDoqynAuth()) {
    const detail = await callDoqynAuthAdmin<{ member: AuthMemberDetail }>(
      req,
      `/auth/admin/members/${membershipId}`,
      { query: { tenantId } },
    );
    const { user } = detail.member;
    return {
      userId: user.id,
      displayName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
      email: user.email,
    };
  }

  const member = await getTenantMemberById(membershipId);
  if (!member || member.tenantId !== tenantId) {
    throw new ServiceError('Membro não encontrado.', 'NOT_FOUND', 404);
  }

  const name = [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email;
  return {
    userId: member.authUserId ?? member.memberId ?? member._id,
    displayName: name,
    email: member.email,
  };
}

export async function updateGovernanceMemberDocumentGroups(
  req: VercelRequest,
  actor: AuthUser,
  tenantId: string,
  membershipId: string,
  documentGroupIds: string[],
): Promise<GovernanceMemberRecord> {
  const identity = await resolveGovernanceMemberIdentity(req, actor, tenantId, membershipId);
  const syncedGroupIds = await syncMemberDocumentGroups(tenantId, actor.id, {
    membershipId,
    userId: identity.userId,
    displayName: identity.displayName,
    email: identity.email,
    documentGroupIds,
  });

  const members = await listGovernanceMembers(req, actor, tenantId);
  const updated = members.find((member) => member.id === membershipId);
  if (!updated) {
    throw new ServiceError('Membro não encontrado após atualização.', 'NOT_FOUND', 404);
  }

  return {
    ...updated,
    groupIds: syncedGroupIds,
    documentGroupIds: syncedGroupIds,
  };
}

/** Membros ativos disponíveis para entrar em um grupo documental (exclui quem já está no grupo). */
export function filterMembersAvailableForDocumentGroup<
  T extends { status: string; groupIds: string[] },
>(members: T[], documentGroupId: string): T[] {
  return members.filter(
    (member) => member.status === 'active' && !member.groupIds.includes(documentGroupId),
  );
}

/** Pure helper for tests: diff document group memberships. */
export function diffDocumentGroupMemberships(
  current: string[],
  desired: string[],
): { toAdd: string[]; toRemove: string[] } {
  const desiredSet = new Set(desired);
  const currentSet = new Set(current);
  return {
    toAdd: desired.filter((id) => !currentSet.has(id)),
    toRemove: current.filter((id) => !desiredSet.has(id)),
  };
}
