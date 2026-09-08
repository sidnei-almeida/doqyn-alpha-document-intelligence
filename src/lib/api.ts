import { authFetch, getFetchCredentials, withAuthHeaders } from '@/auth/apiAuth';
import { parseApiError } from './apiErrors';
import { serializeQueryParams } from './queryParams';

const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await authFetch(`${API_BASE}${path}`, {
    ...options,
    credentials: options?.credentials ?? getFetchCredentials(),
    headers: withAuthHeaders(options?.headers),
  });

  if (!response.ok) {
    /* `ApiError` em vez de `Error`: o `code` que o servidor manda é o que se traduz, e
       descartá-lo aqui obrigava cada tela a reescrever a frase do servidor por cima. */
    throw await parseApiError(response);
  }

  return response.json();
}

export const api = {
  /**
   * Avisa o alpha de que o que ele guardou sobre esta sessão está velho.
   *
   * O front edita conta falando direto com o auth-service, então o alpha não fica sabendo
   * quando idioma, nome ou avatar mudam — e serve por até 45 segundos a sessão em cache.
   */
  session: {
    refresh: () =>
      authFetch(`${API_BASE}/session/refresh`, {
        method: 'POST',
        credentials: getFetchCredentials(),
        headers: withAuthHeaders(),
      }),
  },

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
      return request<{ events: unknown[]; total: number; nextCursor?: string | null }>(
        `/audit${query}`,
      );
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
