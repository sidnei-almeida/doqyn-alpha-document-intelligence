import type { VercelRequest } from '@vercel/node';
import { getDoqynAuthBaseUrl } from '../auth/authConfig.js';
import { ServiceError } from '../utils/serviceErrors.js';

export type DoqynAuthAdminResponse<T> = {
  ok: boolean;
  message?: string;
  code?: string;
} & T;

export async function callDoqynAuthAdmin<T>(
  req: VercelRequest,
  path: string,
  options?: {
    method?: string;
    body?: unknown;
    query?: Record<string, string | undefined>;
  },
): Promise<T> {
  const cookie = req.headers.cookie;
  if (!cookie?.trim()) {
    throw new ServiceError('Sessão não encontrada.', 'INVALID_SESSION', 401);
  }

  const baseUrl = getDoqynAuthBaseUrl();
  const url = new URL(path.startsWith('/') ? `${baseUrl}${path}` : `${baseUrl}/${path}`);

  if (options?.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value?.trim()) url.searchParams.set(key, value.trim());
    }
  }

  const response = await fetch(url, {
    method: options?.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      cookie,
    },
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = (await response.json().catch(() => ({}))) as DoqynAuthAdminResponse<T> & {
    message?: string;
    code?: string;
  };

  if (!response.ok) {
    throw new ServiceError(
      typeof data.message === 'string' ? data.message : 'Não foi possível concluir a operação no auth-service.',
      typeof data.code === 'string' ? data.code : 'AUTH_ADMIN_FAILED',
      response.status,
    );
  }

  return data as T;
}
