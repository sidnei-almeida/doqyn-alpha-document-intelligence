import { authFetch, getFetchCredentials } from '@/auth/apiAuth';
import { usesDoqynAuth } from '@/auth/authConfig';
import { doqynUsersApi } from './doqynUsersApi';

const API_BASE = '/api';

export type PlatformRole = 'doqyn_admin' | 'company_admin' | 'individual_admin' | 'user';
export type MemberStatus = 'pending' | 'active' | 'blocked' | 'rejected';

export type NotificationPreferencesDto = {
  email: boolean;
  whatsapp: boolean;
  documentCreated: boolean;
  documentUpdated: boolean;
  documentRequiresSignature: boolean;
  accessApproved: boolean;
  accessRejected: boolean;
};

export type RequestedAccessDto = {
  personType?: 'individual' | 'business';
  taxIdType?: 'CPF' | 'CNPJ';
  taxIdMasked?: string;
  tenantDisplayName?: string;
  jobTitle?: string;
  departmentText?: string;
  reason?: string;
  requestedAt?: string;
  source?: string;
};

export type MemberConsentDto = {
  textVersion?: string;
  acceptedAt?: string;
  operationalNotificationsConsent?: boolean;
};

export type MemberTermsDto = {
  accepted?: boolean;
  version?: string | null;
  acceptedAt?: string;
};

export type CompanyMemberDto = {
  id: string;
  companyId: string;
  tenantId?: string;
  authUserId?: string;
  username?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  whatsapp?: string;
  platformRoles: PlatformRole[];
  tenantRoles?: PlatformRole[];
  status: MemberStatus;
  accessGroupIds: string[];
  /** Grupos documentais do app principal (Mongo). */
  documentGroupIds: string[];
  /** @deprecated use documentGroupIds */
  groupIds: string[];
  requestedAccess?: RequestedAccessDto;
  consent?: MemberConsentDto;
  terms?: MemberTermsDto;
  notificationPreferences?: NotificationPreferencesDto;
  createdAt: string;
  updatedAt: string;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferencesDto = {
  email: true,
  whatsapp: true,
  documentCreated: true,
  documentUpdated: true,
  documentRequiresSignature: true,
  accessApproved: true,
  accessRejected: true,
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await authFetch(`${API_BASE}${path}`, {
    credentials: getFetchCredentials(),
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof data?.message === 'string'
        ? data.message
        : 'Não foi possível concluir a operação.';
    throw new Error(message);
  }

  return data as T;
}

type GovernanceMemberApi = {
  id: string;
  companyId: string;
  tenantId?: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  whatsapp?: string;
  platformRoles?: PlatformRole[];
  status: MemberStatus;
  accessGroupIds?: string[];
  documentGroupIds?: string[];
  groupIds?: string[];
  requestedAccess?: RequestedAccessDto;
  consent?: MemberConsentDto;
  terms?: MemberTermsDto;
  notificationPreferences?: NotificationPreferencesDto;
  createdAt: string;
  updatedAt: string;
};

function mapGovernanceMember(member: GovernanceMemberApi): CompanyMemberDto {
  const documentGroupIds = member.documentGroupIds ?? member.groupIds ?? [];
  return {
    id: member.id,
    companyId: member.companyId,
    tenantId: member.tenantId ?? member.companyId,
    email: member.email,
    name: member.name,
    firstName: member.firstName,
    lastName: member.lastName,
    whatsapp: member.whatsapp,
    platformRoles: member.platformRoles ?? ['user'],
    tenantRoles: member.platformRoles ?? ['user'],
    status: member.status,
    accessGroupIds: member.accessGroupIds ?? [],
    documentGroupIds,
    groupIds: documentGroupIds,
    requestedAccess: member.requestedAccess,
    consent: member.consent,
    terms: member.terms,
    notificationPreferences: member.notificationPreferences,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
  };
}

export const usersApi = {
  list: async (companyId?: string) => {
    const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
    const data = await request<{ members: GovernanceMemberApi[] }>(`/company-members${query}`);
    return { members: (data.members ?? []).map(mapGovernanceMember) };
  },

  invite: (input: {
    companyId?: string;
    email: string;
    firstName: string;
    lastName: string;
    platformRoles: PlatformRole[];
    accessGroupIds: string[];
  }) => {
    if (usesDoqynAuth()) {
      return doqynUsersApi.invite(input);
    }
    return request<{ member: CompanyMemberDto; temporaryPassword?: string }>('/company-members/invite', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  approve: (
    memberId: string,
    input: {
      platformRoles: PlatformRole[];
      accessGroupIds: string[];
      documentGroupIds?: string[];
      notificationPreferences?: NotificationPreferencesDto;
    },
    tenantId?: string,
  ) => {
    void tenantId;
    return request<{ member: CompanyMemberDto; temporaryPassword?: string }>(
      `/company-members/${memberId}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({
          platformRoles: input.platformRoles,
          accessGroupIds: input.accessGroupIds,
          documentGroupIds: input.documentGroupIds ?? [],
          notificationPreferences: input.notificationPreferences,
        }),
      },
    );
  },

  reject: (memberId: string, reason?: string, tenantId?: string) => {
    void tenantId;
    return request<{ member: CompanyMemberDto }>(`/company-members/${memberId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  block: (memberId: string, tenantId?: string, reason?: string) => {
    if (usesDoqynAuth()) {
      return doqynUsersApi.block(memberId, tenantId, reason);
    }
    const body: Record<string, string> = {};
    if (reason?.trim()) body.reason = reason.trim();
    return request<{ member: CompanyMemberDto }>(`/company-members/${memberId}/block`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  activate: (memberId: string, tenantId?: string) => {
    if (usesDoqynAuth()) {
      return doqynUsersApi.activate(memberId, tenantId);
    }
    return request<{ member: CompanyMemberDto }>(`/company-members/${memberId}/activate`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  updateAccess: (
    memberId: string,
    input: {
      platformRoles: PlatformRole[];
      accessGroupIds: string[];
      notificationPreferences?: NotificationPreferencesDto;
    },
    tenantId?: string,
  ) => {
    if (usesDoqynAuth()) {
      return doqynUsersApi.updateAccess(memberId, input, tenantId);
    }
    return request<{ member: CompanyMemberDto }>(`/company-members/${memberId}/access`, {
      method: 'PATCH',
      body: JSON.stringify({
        tenantRoles: input.platformRoles,
        accessGroupIds: input.accessGroupIds,
        notificationPreferences: input.notificationPreferences,
      }),
    });
  },

  listAccessGroups: (tenantId?: string) => {
    if (usesDoqynAuth()) {
      return doqynUsersApi.listAccessGroups(tenantId);
    }
    return request<{ groups: Array<{ id: string; name: string }> }>('/access-groups').then(
      (data) => data.groups ?? [],
    );
  },

  listDocumentGroups: async (): Promise<
    Array<{ id: string; name: string; description?: string; memberCount?: number }>
  > => {
    const data = await request<{
      groups: Array<{ id: string; name: string; description?: string; memberCount?: number }>;
    }>('/document-groups');
    return (data.groups ?? []).map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      memberCount: group.memberCount ?? 0,
    }));
  },

  updateDocumentGroups: async (
    memberId: string,
    documentGroupIds: string[],
    tenantId?: string,
  ): Promise<CompanyMemberDto> => {
    void tenantId;
    const data = await request<{ member: GovernanceMemberApi }>(
      `/company-members/${memberId}/groups`,
      {
        method: 'PUT',
        body: JSON.stringify({ documentGroupIds }),
      },
    );
    return mapGovernanceMember(data.member);
  },
};

export function suggestGroupsFromDepartment(
  departmentText: string | undefined,
  groups: Array<{ id: string; name: string }>,
): string[] {
  if (!departmentText?.trim()) return [];
  const normalized = departmentText.trim().toLowerCase();
  return groups
    .filter((group) => group.name.toLowerCase().includes(normalized) || normalized.includes(group.name.toLowerCase()))
    .map((group) => group.id);
}
