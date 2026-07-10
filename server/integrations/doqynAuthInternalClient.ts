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
