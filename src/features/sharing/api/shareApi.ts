import { authFetch } from '@/auth/apiAuth';
import { parseDocumentApiError } from '@/features/documents/api/documentsApi.errors';
import type { DocumentListItem } from '@/types/document-library';

export type ShareableUser = {
  userId: string;
  name: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  alreadyShared: boolean;
  /** Veio do histórico de quem está escolhendo. Só marcado quando não há busca digitada. */
  frequent?: boolean;
};

export type DocumentShareEntry = {
  shareId: string;
  sharedWithUserId: string;
  sharedWithName: string;
  sharedWithEmail?: string;
  permissions: {
    canView: boolean;
    canDownload: boolean;
    canShare: boolean;
  };
  message?: string | null;
  createdAt: string;
  sharedByUserId: string;
  expiresAt?: string | null;
  /** Nulo quando o compartilhamento é de casa: lá não há aceite a esperar. */
  inboundStatus?: 'pending' | 'accepted' | 'declined' | null;
  /** A empresa da outra parte, conhecida só depois do aceite. */
  counterpartTenantName?: string | null;
};

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await parseDocumentApiError(response);
  }
  return response.json() as Promise<T>;
}

export async function fetchDocumentShares(documentId: string): Promise<{
  documentId: string;
  shares: DocumentShareEntry[];
}> {
  const encoded = encodeURIComponent(documentId);
  const response = await authFetch(`/api/documents/${encoded}/shares`);
  return parseJson(response);
}

export async function createDocumentShare(
  documentId: string,
  input: {
    /** Do seletor de membros. Um dos dois basta. */
    sharedWithUserId?: string;
    /** Do campo que atravessa a fronteira: o servidor resolve se é de casa ou de fora. */
    sharedWithEmail?: string;
    /** Da busca por apelido. O diretório não devolve e-mail a quem só buscou. */
    sharedWithUsername?: string;
    permissions?: { canView?: boolean; canDownload?: boolean };
    message?: string;
    expiresAt?: string;
  },
): Promise<{ shareId: string; updated: boolean }> {
  const encoded = encodeURIComponent(documentId);
  const response = await authFetch(`/api/documents/${encoded}/shares`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseJson(response);
}

export async function revokeDocumentShare(documentId: string, shareId: string): Promise<void> {
  const doc = encodeURIComponent(documentId);
  const share = encodeURIComponent(shareId);
  const response = await authFetch(`/api/documents/${doc}/shares/${share}`, {
    method: 'DELETE',
  });
  await parseJson(response);
}

export async function searchShareableUsers(
  query: string,
  documentId?: string,
): Promise<ShareableUser[]> {
  const params = new URLSearchParams();
  if (query.trim()) params.set('q', query.trim());
  if (documentId) params.set('documentId', documentId);
  const qs = params.toString();
  const response = await authFetch(`/api/share/users${qs ? `?${qs}` : ''}`);
  const data = await parseJson<{ users: ShareableUser[] }>(response);
  return data.users ?? [];
}

export async function fetchSharedWithMeDocuments(search?: string): Promise<DocumentListItem[]> {
  const params = new URLSearchParams();
  if (search?.trim()) params.set('search', search.trim());
  const qs = params.toString();
  const response = await authFetch(`/api/shared-with-me/documents${qs ? `?${qs}` : ''}`);
  const data = await parseJson<{ items: DocumentListItem[] }>(response);
  return data.items ?? [];
}
