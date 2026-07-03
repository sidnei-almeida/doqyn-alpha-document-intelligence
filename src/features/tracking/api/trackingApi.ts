import { authFetch, getFetchCredentials, withAuthHeaders } from '@/auth/apiAuth';
import type {
  DocumentTrackingDetail,
  DocumentTrackingFilters,
  DocumentTrackingListResponse,
} from '@/types/document-tracking';
import { buildTrackingEventsQuery } from '../utils/trackingDisplay';

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

export async function listDocumentTrackingEvents(
  filters: DocumentTrackingFilters = {},
  cursor?: string | null,
): Promise<DocumentTrackingListResponse> {
  const params = new URLSearchParams(buildTrackingEventsQuery(filters));
  if (cursor) params.set('cursor', cursor);
  const query = params.toString();
  return request<DocumentTrackingListResponse>(
    `/tracking/document-events${query ? `?${query}` : ''}`,
  );
}

export async function getDocumentTrackingEvent(eventId: string): Promise<{ event: DocumentTrackingDetail }> {
  return request<{ event: DocumentTrackingDetail }>(`/tracking/document-events/${eventId}`);
}
