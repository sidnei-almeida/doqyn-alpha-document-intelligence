import { getAuthBasePath } from '@/auth/authConfig';
import { ApiError, parseApiError } from '@/lib/apiErrors';

export type RequestPasswordResetResponse = {
  ok: boolean;
  message: string;
  /** Só fora de produção, quando não há SMTP configurado. */
  resetToken?: string;
};

/**
 * `POST /auth/reset-password` é o único endpoint de auth que devolve erro de negócio sem `code`
 * — só uma `message` em português. Casar pelo texto exato é frágil (qualquer mudança de frase no
 * auth-service quebra o mapeamento em silêncio), mas tocar aquele repo está fora do escopo desta
 * tarefa. As cinco frases abaixo são as únicas que `handlePasswordReset`/`resetPassword` produzem
 * hoje (`doqyn-auth-service/src/modules/auth/auth.service.ts`).
 */
const RESET_REASON_TO_CODE: Record<string, string> = {
  'Muitas tentativas. Tente novamente mais tarde.': 'PASSWORD_RESET_RATE_LIMITED',
  'Token inválido ou expirado.': 'PASSWORD_RESET_TOKEN_INVALID',
  'Token já utilizado.': 'PASSWORD_RESET_TOKEN_USED',
  'A senha deve ter pelo menos 8 caracteres.': 'PASSWORD_RESET_WEAK_PASSWORD',
  'Senha fraca. Use letras e números com pelo menos 8 caracteres.': 'PASSWORD_RESET_WEAK_PASSWORD',
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

  async resetPassword(token: string, newPassword: string): Promise<{ ok: true }> {
    const response = await fetch(`${getAuthBasePath()}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });

    const data = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      message?: string;
      code?: string;
    };

    if (!response.ok) {
      const code = data.code ?? RESET_REASON_TO_CODE[data.message ?? ''] ?? 'PASSWORD_RESET_FAILED';
      throw new ApiError({ status: response.status, code, message: data.message ?? '' });
    }

    return { ok: true };
  },
};
