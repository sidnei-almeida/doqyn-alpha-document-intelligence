import { getAuthBasePath } from '@/auth/authConfig';
import { authServiceJson } from '@/auth/authServiceClient';
import { ApiError, parseApiError } from '@/lib/apiErrors';
import type { PlatformRole } from '@/features/users/api/usersApi';

export type InvitePreview = {
  email: string;
  firstName?: string;
  lastName?: string;
  tenantDisplayName: string;
  tenantTaxIdMasked?: string;
  roles: PlatformRole[];
  expiresAt: string;
  requiresAccountCreation: boolean;
  requiresPassword: boolean;
  requiresWhatsapp: boolean;
};

export type CreateInviteResponse = {
  ok: boolean;
  invite: {
    id: string;
    email: string;
    roles: PlatformRole[];
    expiresAt: string;
    status: string;
  };
  inviteLink: string;
  inviteToken?: string;
  emailSent?: boolean;
  emailSkipReason?: string;
};

async function publicAuthJson<T>(path: string, options?: RequestInit): Promise<T> {
  const base = getAuthBasePath();
  const url = path.startsWith('/') ? `${base}${path}` : `${base}/${path}`;
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return (await response.json()) as T;
}

export const inviteApi = {
  create: (input: {
    email: string;
    firstName?: string;
    lastName?: string;
    platformRoles: PlatformRole[];
    companyId?: string;
  }) =>
    authServiceJson<CreateInviteResponse>('/invites', {
      method: 'POST',
      body: JSON.stringify({
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        roles: input.platformRoles,
        tenantId: input.companyId,
      }),
    }),

  getByToken: (token: string) =>
    publicAuthJson<{ ok: boolean; invite: InvitePreview }>(`/invites/${encodeURIComponent(token)}`),

  accept: (
    token: string,
    input: {
      firstName?: string;
      lastName?: string;
      password?: string;
      whatsapp?: string;
      jobTitle: string;
      departmentText: string;
      operationalNotificationsConsent: true;
      informationDeclaration: true;
      acceptedTerms: true;
      acceptedTermsVersion: string;
    },
  ) =>
    publicAuthJson<{
      ok: boolean;
      message: string;
      requiresLogin?: boolean;
      sessionEstablished?: boolean;
    }>(
      `/invites/${encodeURIComponent(token)}/accept`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    ),

  revoke: (inviteId: string) =>
    authServiceJson<{ ok: boolean; inviteId: string; status: string }>(
      `/invites/${inviteId}/revoke`,
      { method: 'POST', body: JSON.stringify({}) },
    ),
};

export function getInviteErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.friendlyMessage;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Não foi possível concluir a operação.';
}
