import { authFetch, getFetchCredentials, withAuthHeaders } from '@/auth/apiAuth';

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

export type CompanyMemberDto = {
  id: string;
  companyId: string;
  tenantId?: string;
  keycloakUserId?: string;
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
  groupIds: string[];
  requestedAccess?: RequestedAccessDto;
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
    headers: withAuthHeaders({
      'Content-Type': 'application/json',
      ...options?.headers,
    }),
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

export const usersApi = {
  list: (companyId?: string) => {
    const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
    return request<{ members: CompanyMemberDto[] }>(`/company-members${query}`);
  },

  invite: (input: {
    companyId?: string;
    email: string;
    firstName: string;
    lastName: string;
    platformRoles: PlatformRole[];
    accessGroupIds: string[];
  }) =>
    request<{ member: CompanyMemberDto; temporaryPassword?: string }>('/company-members/invite', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  approve: (
    memberId: string,
    input: {
      platformRoles: PlatformRole[];
      accessGroupIds: string[];
      notificationPreferences?: NotificationPreferencesDto;
    },
  ) =>
    request<{ member: CompanyMemberDto; temporaryPassword?: string }>(
      `/company-members/${memberId}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({
          tenantRoles: input.platformRoles,
          accessGroupIds: input.accessGroupIds,
          notificationPreferences: input.notificationPreferences,
        }),
      },
    ),

  reject: (memberId: string, reason?: string) =>
    request<{ member: CompanyMemberDto }>(`/company-members/${memberId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  block: (memberId: string) =>
    request<{ member: CompanyMemberDto }>(`/company-members/${memberId}/block`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  activate: (memberId: string) =>
    request<{ member: CompanyMemberDto }>(`/company-members/${memberId}/activate`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  updateAccess: (
    memberId: string,
    input: {
      platformRoles: PlatformRole[];
      accessGroupIds: string[];
      notificationPreferences?: NotificationPreferencesDto;
    },
  ) =>
    request<{ member: CompanyMemberDto }>(`/company-members/${memberId}/access`, {
      method: 'PATCH',
      body: JSON.stringify({
        tenantRoles: input.platformRoles,
        accessGroupIds: input.accessGroupIds,
        notificationPreferences: input.notificationPreferences,
      }),
    }),
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
