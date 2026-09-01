import { authFetch } from '@/auth/apiAuth';
import { parseDocumentApiError } from '@/features/documents/api/documentsApi.errors';

export type TenantUsageResponse = {
  generatedAt: string;
  documents: number;
  storage: {
    totalBytes: number;
    originalBytes: number;
    previewBytes: number;
    /** Teto do espaço. `null` quando não há cota configurada — a régua some. */
    quotaBytes: number | null;
  };
};

export async function fetchTenantUsage(): Promise<TenantUsageResponse> {
  const response = await authFetch('/api/tenant/usage');

  if (!response.ok) {
    throw await parseDocumentApiError(response);
  }

  return response.json() as Promise<TenantUsageResponse>;
}
