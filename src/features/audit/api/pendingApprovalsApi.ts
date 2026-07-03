import { authServiceJson } from '@/auth/authServiceClient';
import { usesDoqynAuth } from '@/auth/authConfig';
import type { CompanyMemberDto } from '@/features/users/api/usersApi';
import { usersApi } from '@/features/users/api/usersApi';

export type PendingApprovalItem = {
  id: string;
  membershipId: string;
  name: string;
  email: string;
  tenantId: string;
  tenantName?: string;
  type: 'access_request' | 'invite' | 'registration';
  status: 'pending';
  requestedAt: string;
  requestedAccess?: CompanyMemberDto['requestedAccess'];
  member?: CompanyMemberDto;
};

type AuthAccessRequestDetail = {
  id: string;
  status: string;
  membershipId: string | null;
  tenantId: string;
  tenantName: string | null;
  requestedAt: string;
  requester: {
    name: string;
    email: string;
    whatsapp: string | null;
    firstName: string | null;
    lastName: string | null;
  };
  requestedAccess: {
    personType: string;
    taxIdType: string;
    taxIdMasked: string | null;
    tenantDisplayName: string | null;
    jobTitle: string | null;
    departmentText: string | null;
    reason: string | null;
    requestedAt: string;
    source: 'access_request';
  };
  consent: {
    textVersion: string | null;
    acceptedAt: string;
    operationalNotificationsConsent: boolean;
  } | null;
  terms: {
    accepted: boolean;
    version: string | null;
    acceptedAt: string;
  } | null;
  notificationPreferences: CompanyMemberDto['notificationPreferences'] | null;
};

function memberDisplayName(member: CompanyMemberDto): string {
  if (member.firstName || member.lastName) {
    return [member.firstName, member.lastName].filter(Boolean).join(' ');
  }
  return member.name ?? member.email;
}

function inferPendingType(member: CompanyMemberDto): PendingApprovalItem['type'] {
  if (member.requestedAccess?.source === 'access_request' || member.requestedAccess?.reason) {
    return 'access_request';
  }
  if (member.username || member.keycloakUserId) {
    return 'invite';
  }
  return 'registration';
}

function mapMemberToPending(member: CompanyMemberDto): PendingApprovalItem {
  return {
    id: member.id,
    membershipId: member.id,
    name: memberDisplayName(member),
    email: member.email,
    tenantId: member.tenantId ?? member.companyId,
    tenantName: member.requestedAccess?.tenantDisplayName,
    type: inferPendingType(member),
    status: 'pending',
    requestedAt: member.requestedAccess?.requestedAt ?? member.createdAt,
    requestedAccess: member.requestedAccess,
    member,
  };
}

function mapAuthRequestToPending(request: AuthAccessRequestDetail): PendingApprovalItem | null {
  if (!request.membershipId) return null;

  const member: CompanyMemberDto = {
    id: request.membershipId,
    companyId: request.tenantId,
    tenantId: request.tenantId,
    email: request.requester.email,
    name: request.requester.name,
    firstName: request.requester.firstName ?? undefined,
    lastName: request.requester.lastName ?? undefined,
    whatsapp: request.requester.whatsapp ?? undefined,
    platformRoles: ['user'],
    tenantRoles: ['user'],
    status: 'pending',
    accessGroupIds: [],
    documentGroupIds: [],
    groupIds: [],
    requestedAccess: {
      personType:
        request.requestedAccess.personType === 'individual' ||
        request.requestedAccess.personType === 'business'
          ? request.requestedAccess.personType
          : undefined,
      taxIdType:
        request.requestedAccess.taxIdType?.toUpperCase() === 'CPF'
          ? 'CPF'
          : request.requestedAccess.taxIdType?.toUpperCase() === 'CNPJ'
            ? 'CNPJ'
            : undefined,
      taxIdMasked: request.requestedAccess.taxIdMasked ?? undefined,
      tenantDisplayName:
        request.requestedAccess.tenantDisplayName ?? request.tenantName ?? undefined,
      jobTitle: request.requestedAccess.jobTitle ?? undefined,
      departmentText: request.requestedAccess.departmentText ?? undefined,
      reason: request.requestedAccess.reason ?? undefined,
      requestedAt: request.requestedAccess.requestedAt,
      source: request.requestedAccess.source,
    },
    consent: request.consent
      ? {
          textVersion: request.consent.textVersion ?? undefined,
          acceptedAt: request.consent.acceptedAt,
          operationalNotificationsConsent: request.consent.operationalNotificationsConsent,
        }
      : undefined,
    terms: request.terms
      ? {
          accepted: request.terms.accepted,
          version: request.terms.version ?? undefined,
          acceptedAt: request.terms.acceptedAt,
        }
      : undefined,
    notificationPreferences: request.notificationPreferences ?? undefined,
    createdAt: request.requestedAt,
    updatedAt: request.requestedAt,
  };

  return {
    id: request.membershipId,
    membershipId: request.membershipId,
    name: request.requester.name,
    email: request.requester.email,
    tenantId: request.tenantId,
    tenantName: request.tenantName ?? request.requestedAccess.tenantDisplayName ?? undefined,
    type: 'access_request',
    status: 'pending',
    requestedAt: request.requestedAt,
    requestedAccess: member.requestedAccess,
    member,
  };
}

function mergePendingItem(
  existing: PendingApprovalItem,
  incoming: PendingApprovalItem,
): PendingApprovalItem {
  return {
    ...existing,
    ...incoming,
    requestedAccess: incoming.requestedAccess ?? existing.requestedAccess,
    member: incoming.member ?? existing.member,
    tenantName: incoming.tenantName ?? existing.tenantName,
    name: incoming.name !== '—' ? incoming.name : existing.name,
    email: incoming.email !== '—' ? incoming.email : existing.email,
  };
}

export async function listPendingApprovals(tenantId?: string): Promise<PendingApprovalItem[]> {
  const { members } = await usersApi.list(tenantId);
  const pendingMembers = members.filter((member) => member.status === 'pending').map(mapMemberToPending);
  const byMembership = new Map(pendingMembers.map((item) => [item.membershipId, item]));

  if (!usesDoqynAuth()) {
    return pendingMembers;
  }

  try {
    const query = tenantId ? `?status=pending&tenantId=${encodeURIComponent(tenantId)}` : '?status=pending';
    const data = await authServiceJson<{ requests: AuthAccessRequestDetail[] }>(
      `/admin/access-requests${query}`,
    );

    for (const request of data.requests ?? []) {
      const mapped = mapAuthRequestToPending(request);
      if (!mapped) continue;

      const existing = byMembership.get(mapped.membershipId);
      byMembership.set(
        mapped.membershipId,
        existing ? mergePendingItem(existing, mapped) : mapped,
      );
    }

    return [...byMembership.values()].sort(
      (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime(),
    );
  } catch {
    return pendingMembers;
  }
}

export const PENDING_TYPE_LABELS: Record<PendingApprovalItem['type'], string> = {
  access_request: 'Solicitação de acesso',
  invite: 'Convite pendente',
  registration: 'Cadastro aguardando aprovação',
};
