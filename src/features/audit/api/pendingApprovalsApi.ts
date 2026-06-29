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

type AuthAccessRequest = {
  id: string;
  status: string;
  personType?: string;
  taxIdMasked?: string;
  tenantId: string;
  membershipId: string;
  requestedAt: string;
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
    type: inferPendingType(member),
    status: 'pending',
    requestedAt: member.requestedAccess?.requestedAt ?? member.createdAt,
    requestedAccess: member.requestedAccess,
    member,
  };
}

export async function listPendingApprovals(tenantId?: string): Promise<PendingApprovalItem[]> {
  const { members } = await usersApi.list(tenantId);
  const pendingMembers = members.filter((member) => member.status === 'pending').map(mapMemberToPending);

  if (!usesDoqynAuth()) {
    return pendingMembers;
  }

  try {
    const query = tenantId ? `?status=pending&tenantId=${encodeURIComponent(tenantId)}` : '?status=pending';
    const data = await authServiceJson<{ requests: AuthAccessRequest[] }>(
      `/admin/access-requests${query}`,
    );
    const requests = data.requests ?? [];
    const byMembership = new Map(pendingMembers.map((item) => [item.membershipId, item]));

    for (const request of requests) {
      if (byMembership.has(request.membershipId)) continue;
      byMembership.set(request.membershipId, {
        id: request.membershipId,
        membershipId: request.membershipId,
        name: request.taxIdMasked ? `Solicitante ${request.taxIdMasked}` : 'Solicitante',
        email: '—',
        tenantId: request.tenantId,
        type: 'access_request',
        status: 'pending',
        requestedAt: request.requestedAt,
        requestedAccess: {
          personType: request.personType as 'individual' | 'business' | undefined,
          taxIdMasked: request.taxIdMasked,
          requestedAt: request.requestedAt,
          source: 'access_request',
        },
      });
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
