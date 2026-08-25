import { authFetch } from '@/auth/apiAuth';
import type { TenantUploadPolicy } from '@shared/uploadPolicy';

export type UploadPolicyResponse = {
  policy: TenantUploadPolicy;
  canManage: boolean;
};

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(error?.message ?? `HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function fetchUploadPolicy(): Promise<UploadPolicyResponse> {
  const response = await authFetch('/api/settings/upload-policy');
  return parseJson<UploadPolicyResponse>(response);
}

export async function updateUploadPolicy(
  patch: Partial<TenantUploadPolicy>,
): Promise<UploadPolicyResponse> {
  const response = await authFetch('/api/settings/upload-policy', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ policy: patch }),
  });
  return parseJson<UploadPolicyResponse>(response);
}
