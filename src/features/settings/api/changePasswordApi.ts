import { authServiceFetch } from '@/auth/authServiceClient';
import { i18n } from '@/i18n';
import { getFriendlyAuthErrorMessage } from '@/lib/authErrorMessages';

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type ChangePasswordResponse = {
  ok: boolean;
  message?: string;
  code?: string;
  revokedOtherSessions?: number;
};

export class ChangePasswordError extends Error {
  code?: string;
  status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ChangePasswordError';
    this.status = status;
    this.code = code;
  }
}

export async function changePassword(input: ChangePasswordInput): Promise<ChangePasswordResponse> {
  const response = await authServiceFetch('/change-password', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  const data = (await response.json().catch(() => ({}))) as ChangePasswordResponse;

  if (!response.ok) {
    // A frase sai do catálogo pelo `code`; o `message` do servidor é português e existe para log.
    const message = data.code
      ? getFriendlyAuthErrorMessage(data.code, data.message)
      : response.status === 401
        ? i18n.t('settings:changePasswordForm.sessionExpired')
        : (data.message ?? i18n.t('settings:changePasswordForm.changeFailedShort'));
    throw new ChangePasswordError(message, response.status, data.code);
  }

  return data;
}
