import { authFetch } from '@/auth/apiAuth';

export type ExpiryAlertStatus = 'unread' | 'read' | 'dismissed';

export type ExpiryAlert = {
  id: string;
  documentId: string;
  documentName: string;
  categoryName?: string;
  validityDate: string;
  daysRemaining: number;
  offsetDays: number;
  status: ExpiryAlertStatus;
  createdAt: string;
};

export type ExpiryAlertsResponse = {
  items: ExpiryAlert[];
  unreadCount: number;
};

export type MetadataFieldPatch = {
  key: string;
  label?: string;
  value: string | number | null;
};

export type MetadataFieldType = 'string' | 'date' | 'currency' | 'number' | 'boolean';

export type MetadataSheetRow = {
  key: string;
  label: string;
  type: MetadataFieldType;
  required: boolean;
  description?: string;
  value: string | number | null;
  source?: 'ai' | 'document_text' | 'manual';
  confidence?: number;
  fromRule: boolean;
  filled: boolean;
  isValidity: boolean;
};

export type DocumentMetadataSheet = {
  documentId: string;
  versionId: string;
  categoryId: string;
  categoryName?: string;
  canEdit: boolean;
  validityDate: string | null;
  daysRemaining: number | null;
  expiryAlerts: {
    enabled: boolean;
    offsetsDays: number[];
    notifyGroupIds: string[];
    notifyAfterExpiry: boolean;
  } | null;
  dueOffsetDays: number | null;
  missingRequiredCount: number;
  rows: MetadataSheetRow[];
};

export type MetadataUpdateResponse = {
  documentId: string;
  versionId: string;
  updatedKeys: string[];
  removedKeys: string[];
  validityDate: string | null;
};

async function parseError(response: Response): Promise<Error> {
  const body = (await response.json().catch(() => null)) as { message?: string } | null;
  return new Error(body?.message ?? `HTTP ${response.status}`);
}

export async function listExpiryAlerts(params?: {
  status?: ExpiryAlertStatus;
  limit?: number;
}): Promise<ExpiryAlertsResponse> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.limit) query.set('limit', String(params.limit));

  const suffix = query.toString() ? `?${query.toString()}` : '';
  const response = await authFetch(`/api/expiry-alerts${suffix}`);
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as ExpiryAlertsResponse;
}

export async function updateExpiryAlert(
  alertId: string,
  status: 'read' | 'dismissed',
): Promise<{ alert: ExpiryAlert }> {
  const response = await authFetch(`/api/expiry-alerts/${encodeURIComponent(alertId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as { alert: ExpiryAlert };
}

export async function markAllExpiryAlertsRead(): Promise<{ updated: number }> {
  const response = await authFetch('/api/expiry-alerts', { method: 'POST' });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as { updated: number };
}

export async function getDocumentMetadataSheet(documentId: string): Promise<DocumentMetadataSheet> {
  const response = await authFetch(`/api/documents/${encodeURIComponent(documentId)}/metadata`);
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as DocumentMetadataSheet;
}

export async function updateDocumentMetadata(
  documentId: string,
  fields: MetadataFieldPatch[],
): Promise<MetadataUpdateResponse> {
  const response = await authFetch(`/api/documents/${encodeURIComponent(documentId)}/metadata`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as MetadataUpdateResponse;
}
