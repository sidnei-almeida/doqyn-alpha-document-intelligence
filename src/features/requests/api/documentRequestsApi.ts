import { authFetch, getFetchCredentials, withAuthHeaders } from '@/auth/apiAuth';
import { i18n } from '@/i18n';
import { getFriendlyAuthErrorMessage } from '@/lib/authErrorMessages';

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
  /** Presente quando o pedido atravessa a fronteira da empresa. */
  crossTenant?: { requesterTenantName: string };
  requestedFrom: DocumentRequestParty;
  title: string;
  description?: string;
  /** Ausente no pedido para fora: lá o documento não entra no seu acervo. */
  categoryId?: string;
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
    const error = new Error(
      body.code
        ? getFriendlyAuthErrorMessage(body.code, body.message)
        : (body.message ?? i18n.t('requests:actionFailed')),
    );
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
  /** Do seletor de pessoas da empresa. Um dos dois basta. */
  requestedFromUserId?: string;
  /** O caminho que atravessa a fronteira: o servidor resolve se é de casa ou de fora. */
  requestedFromEmail?: string;
  /** Da busca por apelido: o diretório não devolve e-mail a quem só buscou. */
  requestedFromUsername?: string;
  title: string;
  description?: string;
  /** Ausente no pedido para fora: lá o documento não entra no seu acervo. */
  categoryId?: string;
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

/** Chaves com namespace explícito; a tela traduz. */
export const REQUEST_STATUS_LABEL_KEYS: Record<DocumentRequestStatus, string> = {
  pending: 'requests:status.pending',
  fulfilled: 'requests:status.fulfilled',
  cancelled: 'requests:status.cancelled',
  expired: 'requests:status.expired',
};
