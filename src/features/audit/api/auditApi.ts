import { authFetch, getFetchCredentials, withAuthHeaders } from '@/auth/apiAuth';
import { i18n } from '@/i18n';
import { getFriendlyAuthErrorMessage } from '@/lib/authErrorMessages';
import type { AuditEventFilters, AuditEventsResponse, AuditOverview } from '@/types/audit';

const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await authFetch(`${API_BASE}${path}`, {
    ...options,
    credentials: options?.credentials ?? getFetchCredentials(),
    headers: withAuthHeaders({
      'Content-Type': 'application/json',
      ...options?.headers,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const body = data as { message?: unknown; code?: unknown };
    const serverMessage = typeof body.message === 'string' ? body.message : undefined;
    const message =
      typeof body.code === 'string'
        ? getFriendlyAuthErrorMessage(body.code, serverMessage)
        : (serverMessage ?? i18n.t('common:feedback.requestFailed'));
    throw new Error(message);
  }

  return data as T;
}

function buildQuery(params?: AuditEventFilters): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export const auditApi = {
  listEvents: (params?: AuditEventFilters) =>
    request<AuditEventsResponse>(`/audit${buildQuery(params)}`),

  getOverview: () => request<AuditOverview>('/audit/overview'),
};
