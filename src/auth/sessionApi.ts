import { authFetch } from './apiAuth';
import type { MeSession } from './sessionTypes';
import { ApiError, parseApiErrorBody } from '@/lib/apiErrors';
import { accessCodeToGate } from '@/auth/mapMeSession';
import type { AccessGateReason } from './sessionTypes';

export class SessionApiError extends ApiError {
  readonly accessGate?: AccessGateReason;
  readonly partialUser?: MeSession['user'];
  readonly memberships?: Array<{
    membershipId?: string;
    tenantId: string;
    tenantDisplayName?: string | null;
    status: string;
  }>;

  constructor(
    parsed: ConstructorParameters<typeof ApiError>[0] & {
      accessGate?: AccessGateReason;
      partialUser?: MeSession['user'];
      memberships?: SessionApiError['memberships'];
    },
  ) {
    super(parsed);
    this.name = 'SessionApiError';
    this.accessGate = parsed.accessGate;
    this.partialUser = parsed.partialUser;
    this.memberships = parsed.memberships;
  }
}

/**
 * Carrega a sessão oficial do usuário via GET /api/me.
 */
export async function getCurrentSession(): Promise<MeSession> {
  const response = await authFetch('/api/me', { method: 'GET' });

  if (!response.ok) {
    let data: Record<string, unknown> = {};
    try {
      data = (await response.json()) as Record<string, unknown>;
    } catch {
      // resposta não-JSON
    }

    const parsed = parseApiErrorBody(response.status, data);
    const code = parsed.code;
    const accessGate = accessCodeToGate(code);

    if (accessGate || response.status === 403 || response.status === 409) {
      throw new SessionApiError({
        ...parsed,
        accessGate: accessGate ?? undefined,
        partialUser: data.user as MeSession['user'] | undefined,
        memberships: data.memberships as SessionApiError['memberships'],
      });
    }

    throw new SessionApiError(parsed);
  }

  return (await response.json()) as MeSession;
}
