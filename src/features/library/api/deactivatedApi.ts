import { authFetch } from '@/auth/apiAuth';
import type { DocumentListItem } from '@/types/document-library';
import { parseDocumentApiError } from '@/features/documents/api/documentsApi.errors';
import type { BatchTrashResult } from './trashApi';

export type DeactivatedDocumentListItem = DocumentListItem & {
  deactivatedAt?: string;
  deactivatedBy?: string | null;
  deactivatedReason?: string | null;
  lifecycleStatus?: string;
};

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await parseDocumentApiError(response);
  }
  return response.json() as Promise<T>;
}

export async function listDeactivatedDocuments(
  search?: string,
): Promise<DeactivatedDocumentListItem[]> {
  const params = new URLSearchParams();
  if (search?.trim()) params.set('search', search.trim());
  const qs = params.toString();
  const response = await authFetch(`/api/deactivated/documents${qs ? `?${qs}` : ''}`);
  const data = await parseJson<{ items: DeactivatedDocumentListItem[] }>(response);
  return data.items ?? [];
}

export async function reactivateDocument(documentId: string): Promise<void> {
  const encoded = encodeURIComponent(documentId);
  const response = await authFetch(`/api/documents/${encoded}/reactivate`, { method: 'POST' });
  await parseJson(response);
}

export async function batchReactivateDocuments(
  documentIds: string[],
): Promise<BatchTrashResult> {
  const response = await authFetch('/api/documents/batch/reactivate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentIds }),
  });
  return parseJson<BatchTrashResult>(response);
}
