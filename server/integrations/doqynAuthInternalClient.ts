import { getDoqynAuthBaseUrl, getDoqynAuthInternalApiKey } from '../auth/authConfig.js';
import type { AuthTenantMemberSyncSnapshot } from './authTenantMemberTypes.js';
import { ServiceError } from '../utils/serviceErrors.js';

type InternalAvatarMetadata = {
  storageProvider: string | null;
  objectKey: string | null;
  contentType: string | null;
  version: number;
  status: string | null;
};

type InternalAvatarUpdateInput = {
  storageProvider?: 'r2' | 'local' | null;
  objectKey?: string | null;
  contentType?: string | null;
  version: number;
  size?: number | null;
  status: 'active' | 'removed';
};

async function callInternal<T>(path: string, options?: { method?: string; body?: unknown }): Promise<T> {
  const baseUrl = getDoqynAuthBaseUrl();
  const apiKey = getDoqynAuthInternalApiKey();

  const response = await fetch(`${baseUrl}${path}`, {
    method: options?.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    message?: string;
    code?: string;
  };

  if (!response.ok) {
    throw new ServiceError(
      typeof data.message === 'string' ? data.message : 'Falha na comunicação com auth-service.',
      typeof data.code === 'string' ? data.code : 'AUTH_INTERNAL_FAILED',
      response.status,
    );
  }

  return data as T;
}

/**
 * Detalhe de uma solicitação de acesso, como o auth-service a serializa.
 *
 * Só os campos que a fila de pendências mostra. O DTO de lá tem mais — decisão, ids internos —
 * e não replicar o que não se usa evita ter de acompanhar mudanças que não interessam.
 */
export type AuthAccessRequestSnapshot = {
  id: string;
  status: string;
  membershipId: string | null;
  tenantId: string;
  tenantName: string | null;
  requestedAt: string;
  requester: {
    name: string;
    email: string;
    whatsapp: string | null;
    firstName: string | null;
    lastName: string | null;
  };
  requestedAccess: Record<string, unknown> | null;
  consent: Record<string, unknown> | null;
  terms: Record<string, unknown> | null;
  notificationPreferences: Record<string, unknown> | null;
};

export async function fetchTenantAccessRequests(
  tenantId: string,
  status = 'pending',
): Promise<AuthAccessRequestSnapshot[]> {
  const query = `?status=${encodeURIComponent(status)}`;
  const data = await callInternal<{ requests?: AuthAccessRequestSnapshot[] }>(
    `/internal/tenants/${encodeURIComponent(tenantId)}/access-requests${query}`,
  );
  return data.requests ?? [];
}

export async function fetchUserAvatarMetadata(userId: string): Promise<InternalAvatarMetadata> {
  const result = await callInternal<{ ok: true; metadata: InternalAvatarMetadata }>(
    `/internal/users/${encodeURIComponent(userId)}/avatar-metadata`,
  );
  return result.metadata;
}

export async function updateUserAvatarMetadata(
  userId: string,
  input: InternalAvatarUpdateInput,
): Promise<void> {
  await callInternal(`/internal/users/${encodeURIComponent(userId)}/avatar-metadata`, {
    method: 'PATCH',
    body: input,
  });
}

export async function fetchAuthTenantMembersForSync(
  tenantId: string,
): Promise<AuthTenantMemberSyncSnapshot[]> {
  const result = await callInternal<{ ok: true; members: AuthTenantMemberSyncSnapshot[] }>(
    `/internal/tenants/${encodeURIComponent(tenantId)}/members`,
  );
  return result.members ?? [];
}
