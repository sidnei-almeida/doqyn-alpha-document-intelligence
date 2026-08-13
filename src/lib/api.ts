import { authFetch, getFetchCredentials, withAuthHeaders } from '@/auth/apiAuth';
import { serializeQueryParams } from './queryParams';

const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await authFetch(`${API_BASE}${path}`, {
    ...options,
    credentials: options?.credentials ?? getFetchCredentials(),
    headers: withAuthHeaders(options?.headers),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Erro na requisição' }));
    throw new Error(error.message ?? `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  health: () => request<{ status: string; timestamp: string; environment: string }>('/health'),

  documents: {
    list: (params?: Record<string, string>) => {
      const query = serializeQueryParams(params);
      return request<import('@/types/document-library').DocumentListResponse>(`/documents${query}`);
    },
    get: (id: string) =>
      request<import('@/types/document-library').DocumentDetailResponse>(`/documents/${id}`),
    timeline: (documentId: string, params?: Record<string, string>) => {
      const query = serializeQueryParams(params);
      return request<import('@/types/document-audit').DocumentTimelineResponse>(
        `/documents/${documentId}/timeline${query}`,
      );
    },
  },

  audit: {
    list: (params?: Record<string, string>) => {
      const query = serializeQueryParams(params);
      return request<{ events: unknown[]; total: number; nextCursor?: string | null }>(`/audit${query}`);
    },
    overview: () =>
      request<{
        pendingCount: number;
        pendingUsersCount: number;
        todayEventsCount: number;
        criticalEventsCount: number;
        totalEventsCount?: number;
      }>('/audit/overview'),
  },
};
