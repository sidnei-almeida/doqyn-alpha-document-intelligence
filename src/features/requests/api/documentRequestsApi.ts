import { authFetch, getFetchCredentials, withAuthHeaders } from '@/auth/apiAuth';

export type DocumentRequestStatus = 'pending' | 'fulfilled' | 'cancelled' | 'expired';

export type DocumentRequestParty = {
  userId: string;
  name: string;
  email: string;
};

export type DocumentRequestItem = {
  _id: string;
  tenantId: string;
  requestedBy: DocumentRequestParty;
  requestedFrom: DocumentRequestParty;
  title: string;
  description?: string;
  categoryId: string;
  categoryName?: string;
  dueAt?: string;
  status: DocumentRequestStatus;
  fulfilledDocumentId?: string;
  fulfilledAt?: string;
  createdAt: string;
};

/** `received` é o que me pediram; `sent` é o que eu pedi. */
export type DocumentRequestDirection = 'received' | 'sent';

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
    const error = new Error(body.message ?? 'Não foi possível concluir a ação.');
    if (body.code) (error as Error & { code?: string }).code = body.code;
    throw error;
  }
  return response.json() as Promise<T>;
}

export async function listDocumentRequests(input: {
  direction: DocumentRequestDirection;
  status?: DocumentRequestStatus;
}): Promise<DocumentRequestItem[]> {
  const params = new URLSearchParams({ direction: input.direction });
  if (input.status) params.set('status', input.status);

  const response = await authFetch(`/api/document-requests?${params.toString()}`, {
    credentials: getFetchCredentials(),
    headers: withAuthHeaders(),
  });
  const data = await parse<{ items: DocumentRequestItem[] }>(response);
  return data.items ?? [];
}

export async function createDocumentRequest(input: {
  requestedFromUserId: string;
  title: string;
  description?: string;
  categoryId: string;
  dueAt?: string;
}): Promise<DocumentRequestItem> {
  const response = await authFetch('/api/document-requests', {
    method: 'POST',
    credentials: getFetchCredentials(),
    headers: { ...withAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await parse<{ request: DocumentRequestItem }>(response);
  return data.request;
}

export async function cancelDocumentRequest(requestId: string): Promise<void> {
  const response = await authFetch(
    `/api/document-requests/${encodeURIComponent(requestId)}/cancel`,
    {
      method: 'POST',
      credentials: getFetchCredentials(),
      headers: withAuthHeaders(),
    },
  );
  await parse<{ request: DocumentRequestItem }>(response);
}

export const REQUEST_STATUS_LABEL: Record<DocumentRequestStatus, string> = {
  pending: 'Aguardando',
  fulfilled: 'Atendido',
  cancelled: 'Cancelado',
  expired: 'Vencido',
};
