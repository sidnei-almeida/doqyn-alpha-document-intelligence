import { authServiceFetch } from '@/auth/authServiceClient';

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
    const message =
      typeof data.message === 'string'
        ? data.message
        : response.status === 401
          ? 'Sessão expirada. Faça login novamente.'
          : 'Não foi possível alterar a senha.';
    throw new ChangePasswordError(message, response.status, data.code);
  }

  return data;
}
