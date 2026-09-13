import { authFetch } from '@/auth/apiAuth';
import { i18n } from '@/i18n';
import { categoryDisplayName } from '@/features/documents/utils/categoryDisplay';
import { getFriendlyAuthErrorMessage } from '@/lib/authErrorMessages';

export type DocumentAccessOrigin = 'owner' | 'admin' | 'governance' | 'share';

export type AccessMatrixMember = {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  isAdmin: boolean;
  groupIds: string[];
};

export type AccessMatrixVerbs = {
  canView: boolean;
  canDownload: boolean;
  canUpdate: boolean;
  canAudit: boolean;
  canShare: boolean;
};

export type AccessMatrixCell = {
  documentId: string;
  membershipId: string;
  origins: DocumentAccessOrigin[];
  canDownload: boolean;
  /** Opcional para sobreviver a uma API mais antiga durante o deploy. */
  permissions?: AccessMatrixVerbs;
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

export type AccessMatrixGroupCell = {
  documentId: string;
  groupId: string;
  canView: boolean;
  canDownload: boolean;
  canUpdate: boolean;
  canAudit: boolean;
  canShare: boolean;
};

export type AccessMatrix = {
  members: AccessMatrixMember[];
  groups: Array<{ groupId: string; name: string; memberCount: number }>;
  documents: AccessMatrixDocument[];
  cells: AccessMatrixCell[];
  /** Opcional para sobreviver a uma API mais antiga durante o deploy. */
  groupCells?: AccessMatrixGroupCell[];
  pagination: { nextCursor: string | null };
};

async function parseJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as
    | T
    | { message?: string; code?: string }
    | null;
  if (!response.ok) {
    const body = (data && typeof data === 'object' ? data : {}) as {
      message?: unknown;
      code?: unknown;
    };
    const serverMessage = body.message ? String(body.message) : undefined;
    const message =
      typeof body.code === 'string'
        ? getFriendlyAuthErrorMessage(body.code, serverMessage)
        : (serverMessage ?? i18n.t('matrix:loadFailed'));
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
  const matrix = await parseJson<AccessMatrix>(response);
  return {
    ...matrix,
    documents: matrix.documents.map((doc) => ({
      ...doc,
      categoryName: categoryDisplayName(doc.categoryName, { id: doc.categoryId }),
    })),
  };
}
