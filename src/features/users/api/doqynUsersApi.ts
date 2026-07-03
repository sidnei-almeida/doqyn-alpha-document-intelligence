import { authServiceJson } from '@/auth/authServiceClient';
import type {
  CompanyMemberDto,
  MemberStatus,
  NotificationPreferencesDto,
  PlatformRole,
} from './usersApi';

type AuthMembership = {
  membershipId: string;
  tenantId: string;
  tenantType: string;
  tenantDisplayName: string | null;
  status: MemberStatus | 'removed';
  roles: PlatformRole[];
  accessGroupIds: string[];
};

type MemberDetail = {
  user: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    status: string;
  };
  membership: AuthMembership;
  tenant: {
    tenantId: string;
    tenantType: string;
    displayName: string | null;
    status: string;
  };
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
};

function mapDetailToDto(detail: MemberDetail): CompanyMemberDto {
  const { user, membership } = detail;
  return {
    id: membership.membershipId,
    companyId: membership.tenantId,
    tenantId: membership.tenantId,
    email: user.email,
    firstName: user.firstName ?? undefined,
    lastName: user.lastName ?? undefined,
    name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
    platformRoles: membership.roles,
    tenantRoles: membership.roles,
    status: membership.status === 'removed' ? 'rejected' : membership.status,
    accessGroupIds: membership.accessGroupIds,
    documentGroupIds: [],
    groupIds: [],
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
  };
}

async function fetchMemberDetail(membershipId: string, tenantId?: string): Promise<CompanyMemberDto> {
  const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
  const data = await authServiceJson<{ member: MemberDetail }>(
    `/admin/members/${membershipId}${query}`,
  );
  return mapDetailToDto(data.member);
}

export const doqynUsersApi = {
  async listAccessGroups(tenantId?: string): Promise<Array<{ id: string; name: string }>> {
    const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}&status=active` : '?status=active';
    const data = await authServiceJson<{
      groups: Array<{ groupId: string; name: string; status: string }>;
    }>(`/admin/access-groups${query}`);
    return (data.groups ?? [])
      .filter((group) => group.status === 'active')
      .map((group) => ({ id: group.groupId, name: group.name }));
  },

  async list(tenantId?: string): Promise<CompanyMemberDto[]> {
    const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    const data = await authServiceJson<{ items: AuthMembership[] }>(`/admin/members${query}`);
    const items = data.items ?? [];
    const details = await Promise.all(
      items.map((item) => fetchMemberDetail(item.membershipId, tenantId ?? item.tenantId)),
    );
    return details;
  },

  approve(
    membershipId: string,
    input: {
      platformRoles: PlatformRole[];
      accessGroupIds: string[];
      notificationPreferences?: NotificationPreferencesDto;
    },
    tenantId?: string,
  ) {
    const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    return authServiceJson<{ membership: AuthMembership }>(
      `/admin/members/${membershipId}/approve${query}`,
      {
        method: 'POST',
        body: JSON.stringify({
          roles: input.platformRoles,
          accessGroupIds: input.accessGroupIds,
          notificationPreferences: input.notificationPreferences,
        }),
      },
    ).then(async () => ({ member: await fetchMemberDetail(membershipId, tenantId) }));
  },

  reject(membershipId: string, reason: string, tenantId?: string) {
    const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    return authServiceJson(`/admin/members/${membershipId}/reject${query}`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }).then(async () => ({ member: await fetchMemberDetail(membershipId, tenantId) }));
  },

  block(membershipId: string, tenantId?: string, reason?: string) {
    const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    const body: Record<string, unknown> = {};
    if (reason?.trim()) body.reason = reason.trim();
    return authServiceJson(`/admin/members/${membershipId}/block${query}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }).then(async () => ({ member: await fetchMemberDetail(membershipId, tenantId) }));
  },

  activate(membershipId: string, tenantId?: string) {
    const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    return authServiceJson(`/admin/members/${membershipId}/unblock${query}`, {
      method: 'POST',
      body: JSON.stringify({}),
    }).then(async () => ({ member: await fetchMemberDetail(membershipId, tenantId) }));
  },

  updateAccess(
    membershipId: string,
    input: {
      platformRoles: PlatformRole[];
      accessGroupIds: string[];
      notificationPreferences?: NotificationPreferencesDto;
    },
    tenantId?: string,
  ) {
    const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    return authServiceJson(`/admin/members/${membershipId}/roles${query}`, {
      method: 'PATCH',
      body: JSON.stringify({ roles: input.platformRoles }),
    }).then(() =>
      authServiceJson(`/admin/members/${membershipId}/access-groups${query}`, {
        method: 'PATCH',
        body: JSON.stringify({ accessGroupIds: input.accessGroupIds }),
      }),
    ).then(async () => ({ member: await fetchMemberDetail(membershipId, tenantId) }));
  },
};
