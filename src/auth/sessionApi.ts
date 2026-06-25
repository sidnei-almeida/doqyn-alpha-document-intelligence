import { authFetch } from './apiAuth';
import type { MeSession } from './sessionTypes';

export class SessionApiError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = 'SessionApiError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

type MeApiErrorBody = {
  message?: string;
  code?: string;
};

/**
 * Carrega a sessão oficial do usuário via GET /api/me (Bearer quando Keycloak).
 */
export async function getCurrentSession(): Promise<MeSession> {
  const response = await authFetch('/api/me', { method: 'GET' });

  if (!response.ok) {
    let body: MeApiErrorBody = {};
    try {
      body = (await response.json()) as MeApiErrorBody;
    } catch {
      // resposta não-JSON
    }

    throw new SessionApiError(
      body.message ?? 'Não foi possível carregar a sessão.',
      body.code ?? 'SESSION_ERROR',
      response.status,
    );
  }

  return (await response.json()) as MeSession;
}
