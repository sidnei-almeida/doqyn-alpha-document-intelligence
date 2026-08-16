import { authFetch } from '@/auth/apiAuth';

export type DocumentAccessOrigin = 'owner' | 'admin' | 'governance' | 'share';

export type AccessMatrixMember = {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  isAdmin: boolean;
  groupIds: string[];
};

export type AccessMatrixCell = {
  documentId: string;
  membershipId: string;
  origins: DocumentAccessOrigin[];
  canDownload: boolean;
  viaGroupIds: string[];
  shareGrantId?: string;
};

export type AccessMatrixDocument = {
  documentId: string;
  fileName: string;
  categoryId?: string;
  categoryName?: string;
  ownerUserId?: string;
  ownerName?: string;
  updatedAt?: string;
  externalShareCount: number;
};

export type AccessMatrix = {
  members: AccessMatrixMember[];
  groups: Array<{ groupId: string; name: string }>;
  documents: AccessMatrixDocument[];
  cells: AccessMatrixCell[];
  pagination: { nextCursor: string | null };
};

export type MetadataMatrixColumn = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  isValidity: boolean;
};

export type MetadataMatrixRow = {
  documentId: string;
  versionId?: string;
  fileName: string;
  ownerName?: string;
  updatedAt?: string;
  canEdit: boolean;
  values: Record<string, string | number | null>;
  sources: Record<string, string | undefined>;
  missingRequired: string[];
};

export type MetadataMatrix = {
  categoryId: string;
  categoryName?: string;
  columns: MetadataMatrixColumn[];
  rows: MetadataMatrixRow[];
  pagination: { nextCursor: string | null };
};

async function parseJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as T | { message?: string } | null;
  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'message' in data && data.message
        ? String(data.message)
        : 'Não foi possível carregar a matriz.';
    throw new Error(message);
  }
  return data as T;
}

export async function fetchAccessMatrix(params: {
  search?: string;
  categoryId?: string;
  limit?: number;
}): Promise<AccessMatrix> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.categoryId) query.set('categoryId', params.categoryId);
  query.set('limit', String(params.limit ?? 25));

  const response = await authFetch(`/api/documents/matrix/access?${query.toString()}`);
  return parseJson<AccessMatrix>(response);
}

export async function fetchMetadataMatrix(params: {
  categoryId: string;
  search?: string;
  limit?: number;
}): Promise<MetadataMatrix> {
  const query = new URLSearchParams();
  query.set('categoryId', params.categoryId);
  if (params.search) query.set('search', params.search);
  query.set('limit', String(params.limit ?? 25));

  const response = await authFetch(`/api/documents/matrix/metadata?${query.toString()}`);
  return parseJson<MetadataMatrix>(response);
}

/**
 * Grava um campo de um documento.
 *
 * Reaproveita a rota da ficha de metadados: é a mesma operação, com a mesma trilha de auditoria —
 * a matriz é só outro lugar de onde disparar.
 */
export async function updateDocumentMetadataField(input: {
  documentId: string;
  key: string;
  label: string;
  value: string | number | null;
}): Promise<void> {
  const response = await authFetch(
    `/api/documents/${encodeURIComponent(input.documentId)}/metadata`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: [{ key: input.key, label: input.label, value: input.value }],
      }),
    },
  );
  await parseJson<unknown>(response);
}
