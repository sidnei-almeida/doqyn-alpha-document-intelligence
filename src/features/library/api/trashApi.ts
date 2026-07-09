import { authFetch } from '@/auth/apiAuth';
import type { DocumentListItem } from '@/types/document-library';
import { parseDocumentApiError } from '@/features/documents/api/documentsApi.errors';

export type TrashDocumentListItem = DocumentListItem & {
  deletedAt?: string;
  deletedBy?: string | null;
  deletedReason?: string | null;
  trashExpiresAt?: string | null;
  lifecycleStatus?: string;
};

export type TrashRetentionSettings = {
  trashRetentionMode: 'days' | 'manual';
  trashRetentionDays: number;
};

export type BatchTrashResult = {
  results: Array<{ documentId: string; ok: boolean; error?: string; code?: string }>;
  succeeded: number;
  failed: number;
};

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await parseDocumentApiError(response);
  }
  return response.json() as Promise<T>;
}

export async function listTrashDocuments(search?: string): Promise<TrashDocumentListItem[]> {
  const params = new URLSearchParams();
  if (search?.trim()) params.set('search', search.trim());
  const qs = params.toString();
  const response = await authFetch(`/api/trash/documents${qs ? `?${qs}` : ''}`);
  const data = await parseJson<{ items: TrashDocumentListItem[] }>(response);
  return data.items ?? [];
}

export async function moveDocumentToTrash(documentId: string, reason?: string): Promise<void> {
  const encoded = encodeURIComponent(documentId);
  const response = await authFetch(`/api/documents/${encoded}/trash`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  await parseJson(response);
}

export async function restoreDocumentFromTrash(documentId: string): Promise<void> {
  const encoded = encodeURIComponent(documentId);
  const response = await authFetch(`/api/documents/${encoded}/restore`, { method: 'POST' });
  await parseJson(response);
}

export async function permanentlyDeleteDocument(documentId: string): Promise<void> {
  const encoded = encodeURIComponent(documentId);
  const response = await authFetch(`/api/documents/${encoded}/permanent`, { method: 'DELETE' });
  await parseJson(response);
}

export async function batchMoveDocumentsToTrash(documentIds: string[]): Promise<BatchTrashResult> {
  const response = await authFetch('/api/documents/batch/trash', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentIds }),
  });
  return parseJson<BatchTrashResult>(response);
}

export async function batchRestoreDocuments(documentIds: string[]): Promise<BatchTrashResult> {
  const response = await authFetch('/api/documents/batch/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentIds }),
  });
  return parseJson<BatchTrashResult>(response);
}

export async function batchPermanentlyDeleteDocuments(
  documentIds: string[],
): Promise<BatchTrashResult> {
  const response = await authFetch('/api/documents/batch/permanent-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentIds }),
  });
  return parseJson<BatchTrashResult>(response);
}

export async function fetchTrashRetentionSettings(): Promise<TrashRetentionSettings> {
  const response = await authFetch('/api/settings/trash-retention');
  const data = await parseJson<{ settings: TrashRetentionSettings }>(response);
  return data.settings;
}

export async function updateTrashRetentionSettings(
  patch: Partial<TrashRetentionSettings>,
): Promise<TrashRetentionSettings> {
  const response = await authFetch('/api/settings/trash-retention', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const data = await parseJson<{ settings: TrashRetentionSettings }>(response);
  return data.settings;
}
