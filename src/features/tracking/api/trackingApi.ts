import { authFetch, getFetchCredentials, withAuthHeaders } from '@/auth/apiAuth';
import type {
  ClientTrackingEventInput,
  DocumentTrackingDetail,
  DocumentTrackingFilters,
  DocumentTrackingListResponse,
  TrackingSummary,
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

export async function fetchTrackingSummary(filters: Pick<DocumentTrackingFilters, 'from' | 'to'> = {}): Promise<TrackingSummary> {
  const params = new URLSearchParams();
  if (filters.from?.trim()) params.set('from', filters.from.trim());
  if (filters.to?.trim()) params.set('to', filters.to.trim());
  const query = params.toString();
  return request<TrackingSummary>(`/tracking/summary${query ? `?${query}` : ''}`);
}

export async function postClientTrackingEvent(input: ClientTrackingEventInput): Promise<{ id: string | null }> {
  return request<{ id: string | null }>('/tracking/client-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
