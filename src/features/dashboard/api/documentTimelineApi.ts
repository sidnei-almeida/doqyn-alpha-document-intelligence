import { authFetch, getFetchCredentials, withAuthHeaders } from '@/auth/apiAuth';

export type DocumentTimelineItem = {
  id: string;
  action: string;
  severity: 'info' | 'warning' | 'error';
  occurredAt: string;
  summary: string;
  actor: {
    userId: string;
    displayName?: string;
    email?: string;
  };
};

/** Timeline de auditoria de um documento (requer canViewTracking). */
export async function fetchDocumentTimeline(
  documentId: string,
  limit = 12,
): Promise<DocumentTimelineItem[]> {
  const params = new URLSearchParams({ documentId, limit: String(limit) });
  const response = await authFetch(`/api/documents/timeline?${params.toString()}`, {
    credentials: getFetchCredentials(),
    headers: withAuthHeaders(),
  });

  const data = (await response.json().catch(() => ({}))) as {
    items?: DocumentTimelineItem[];
    message?: string;
  };

  if (!response.ok) {
    throw new Error(data.message ?? 'Não foi possível carregar a atividade do documento.');
  }

  return data.items ?? [];
}
