import { authFetch } from '@/auth/apiAuth';
import { parseDocumentApiError } from '@/features/documents/api/documentsApi.errors';

export type MoveDocumentResponse = {
  ok: boolean;
  moved: number;
  skipped: Array<{ documentId: string; reason: string }>;
  targetClassId: string;
  targetCategoryName: string;
  result?: {
    documentId: string;
    ok: boolean;
    oldClassId?: string;
    oldCategoryName?: string;
    newClassId?: string;
    newCategoryName?: string;
  };
};

export type BatchMoveDocumentsResponse = {
  ok: boolean;
  moved: number;
  skipped: Array<{ documentId: string; reason: string }>;
  failed: Array<{ documentId: string; error: string; code?: string }>;
  targetClassId: string;
  targetCategoryName: string;
};

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await parseDocumentApiError(response);
  }
  return response.json() as Promise<T>;
}

export async function moveDocumentToCategory(
  documentId: string,
  targetClassId: string,
  reason?: string,
): Promise<MoveDocumentResponse> {
  const encoded = encodeURIComponent(documentId);
  const response = await authFetch(`/api/documents/${encoded}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetClassId, reason }),
  });
  return parseJson<MoveDocumentResponse>(response);
}

export async function batchMoveDocumentsToCategory(
  documentIds: string[],
  targetClassId: string,
  reason?: string,
): Promise<BatchMoveDocumentsResponse> {
  const response = await authFetch('/api/documents/batch/move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentIds, targetClassId, reason }),
  });
  return parseJson<BatchMoveDocumentsResponse>(response);
}
