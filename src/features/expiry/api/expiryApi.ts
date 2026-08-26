import { authFetch } from '@/auth/apiAuth';

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
  /** Forma canônica do mesmo dado, quando a extração conseguiu normalizar (datas, sobretudo). */
  normalizedValue?: string | number | null;
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

export type RenameDocumentResponse = {
  documentId: string;
  previousFileName: string;
  fileName: string;
  versionId: string;
};

/** Renomeia o rótulo do documento — versões e objeto no storage ficam intactos. */
export async function renameDocument(
  documentId: string,
  fileName: string,
): Promise<RenameDocumentResponse> {
  const response = await authFetch(`/api/documents/${encodeURIComponent(documentId)}/rename`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? 'Não foi possível renomear o documento.');
  }

  return (await response.json()) as RenameDocumentResponse;
}
