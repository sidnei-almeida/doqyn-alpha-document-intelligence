import { getAuthBasePath } from '@/auth/authConfig';
import { parseApiError } from '@/lib/apiErrors';

export type RequestPasswordResetResponse = {
  ok: boolean;
  message: string;
  /** Só fora de produção, quando não há SMTP configurado. */
  resetToken?: string;
};

/**
 * As rotas de redefinição são públicas e não usam cookie: quem chega aqui não tem sessão (ou não
 * quer usar a que já tem), então mandar credencial não teria o que autenticar.
 */
async function passwordResetJson<T>(path: string, options?: RequestInit): Promise<T> {
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

export const passwordResetApi = {
  requestReset: (email: string) =>
    passwordResetJson<RequestPasswordResetResponse>('/request-password-reset', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  // adicionado na Tarefa 2
};
