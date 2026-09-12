import { getAuthBasePath } from '@/auth/authConfig';
import { ApiError, parseApiError } from '@/lib/apiErrors';
import { i18n } from '@/i18n';

export type EmailVerificationStatus = {
  ok: boolean;
  verified: boolean;
  pending: boolean;
  email?: string;
  expiresAt?: string;
  linkExpiresAt?: string;
  attemptsLeft?: number;
  canResendAt?: string;
};

export type SendEmailVerificationResponse = {
  ok: boolean;
  message: string;
  email: string;
  expiresAt: string;
  emailSent: boolean;
  /** Só em desenvolvimento, quando não há SMTP configurado. */
  code?: string;
  confirmUrl?: string;
};

/**
 * As rotas de verificação são públicas e não usam cookie.
 *
 * Quem precisa delas é justamente quem o login recusou, então mandar credencial aqui não teria o
 * que autenticar — o que autoriza é o ticket, que vai no corpo (ou na query, no estado).
 */
async function verificationJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${getAuthBasePath()}${path}`, {
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

export const emailVerificationApi = {
  getStatus: (ticket: string) =>
    verificationJson<EmailVerificationStatus>(
      `/email-verification?ticket=${encodeURIComponent(ticket)}`,
    ),

  send: (ticket: string) =>
    verificationJson<SendEmailVerificationResponse>('/email-verification/send', {
      method: 'POST',
      body: JSON.stringify({ ticket }),
    }),

  resend: (ticket: string) =>
    verificationJson<SendEmailVerificationResponse>('/email-verification/resend', {
      method: 'POST',
      body: JSON.stringify({ ticket }),
    }),

  confirmCode: (ticket: string, code: string) =>
    verificationJson<{ ok: boolean; message: string }>('/email-verification/confirm', {
      method: 'POST',
      body: JSON.stringify({ ticket, code }),
    }),

  confirmToken: (token: string) =>
    verificationJson<{ ok: boolean; message: string }>(
      `/email-verification/${encodeURIComponent(token)}/confirm`,
      { method: 'POST', body: JSON.stringify({}) },
    ),
};

export function getEmailVerificationErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.friendlyMessage;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return i18n.t('auth:emailVerification.confirmFailed');
}
