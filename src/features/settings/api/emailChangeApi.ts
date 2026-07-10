import { authServiceJson } from '@/auth/authServiceClient';
import { getAuthBasePath } from '@/auth/authConfig';
import { ApiError, parseApiError } from '@/lib/apiErrors';

export type EmailChangeStatus =
  | { pending: false }
  | { pending: true; newEmail: string; expiresAt: string };

export type RequestEmailChangeResponse = {
  ok: boolean;
  message: string;
  pendingEmail: string;
  expiresAt: string;
  emailSent: boolean;
  confirmToken?: string;
  confirmUrl?: string;
};

async function publicAuthJson<T>(path: string, options?: RequestInit): Promise<T> {
  const base = getAuthBasePath();
  const url = path.startsWith('/') ? `${base}${path}` : `${base}/${path}`;
  const response = await fetch(url, {
    ...options,
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

export const emailChangeApi = {
  getStatus: () =>
    authServiceJson<{ ok: boolean } & EmailChangeStatus>('/account/email-change'),

  request: (input: { newEmail: string; password: string }) =>
    authServiceJson<RequestEmailChangeResponse>('/account/email-change/request', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  preview: (token: string) =>
    publicAuthJson<{
      ok: boolean;
      currentEmail: string;
      newEmail: string;
      expiresAt: string;
    }>(`/account/email-change/${encodeURIComponent(token)}`),

  confirm: (token: string) =>
    publicAuthJson<{ ok: boolean; message: string }>(
      `/account/email-change/${encodeURIComponent(token)}/confirm`,
      { method: 'POST', body: JSON.stringify({}) },
    ),
};

export function getEmailChangeErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.friendlyMessage;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Não foi possível concluir a operação.';
}
