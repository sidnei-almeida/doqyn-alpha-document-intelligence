import type { AuthUser } from '../auth/types.js';
import { userHasRole } from '../auth/requireAuth.js';
import { getTenantCollections } from './getTenantCollections.js';
import { tenantScopeFilterFromContext } from './tenantQuery.js';
import { ServiceError } from '../utils/serviceErrors.js';
import type { MongoDocument } from '../db/types.js';

export type DocumentAccessPermissions = {
  canPreview: boolean;
  canDownload: boolean;
  canEditMetadata: boolean;
};

const DOCUMENT_ADMIN_ROLES = new Set(['doqyn_admin', 'company_admin', 'individual_admin']);

export function isDocumentAdmin(user: AuthUser): boolean {
  const roles = user.platformRoles ?? [];
  if (roles.some((role) => DOCUMENT_ADMIN_ROLES.has(role))) return true;
  return userHasRole(user, ['admin', 'manager']);
}

export function userHasDocumentGroupAccess(
  requiredGroupIds: string[] | undefined,
  memberGroupIds: string[],
): boolean {
  if (!requiredGroupIds?.length) return false;
  return requiredGroupIds.some((groupId) => memberGroupIds.includes(groupId));
}

export function resolveDocumentPermissions(
  user: AuthUser,
  doc: Pick<MongoDocument, 'ownerUserId' | 'access'>,
  memberGroupIds: string[],
): DocumentAccessPermissions {
  const isAdmin = isDocumentAdmin(user);
  const isOwner = Boolean(doc.ownerUserId && doc.ownerUserId === user.id);
  const viewGroups = doc.access?.viewGroupIds ?? [];
  const downloadGroups = doc.access?.downloadGroupIds ?? [];

  const canPreview =
    isAdmin || isOwner || userHasDocumentGroupAccess(viewGroups, memberGroupIds);

  const canDownload =
    isAdmin || isOwner || userHasDocumentGroupAccess(downloadGroups, memberGroupIds);

  return {
    canPreview,
    canDownload,
    canEditMetadata: isAdmin,
  };
}

export function assertCanPreviewDocument(permissions: DocumentAccessPermissions): void {
  if (!permissions.canPreview) {
    throw new ServiceError(
      'Você não tem permissão para visualizar este documento.',
      'DOCUMENT_ACCESS_DENIED',
      403,
    );
  }
}

export function assertCanDownloadDocument(permissions: DocumentAccessPermissions): void {
  if (!permissions.canDownload) {
    throw new ServiceError(
      'Você não tem permissão para baixar este documento.',
      'DOCUMENT_ACCESS_DENIED',
      403,
    );
  }
}

export async function loadMemberDocumentGroupIds(input: {
  tenantId: string;
  userId: string;
  membershipId?: string;
}): Promise<string[]> {
  const { documentGroupMembers, storage } = await getTenantCollections(input.tenantId, {
    userId: input.userId,
    membershipId: input.membershipId,
  });

  if (!documentGroupMembers) return [];

  const query: Record<string, unknown> = {
    ...tenantScopeFilterFromContext(storage),
    userId: input.userId,
    active: true,
  };

  if (input.membershipId?.trim()) {
    query.membershipId = input.membershipId.trim();
  }

  const rows = await documentGroupMembers.find(query).toArray();
  return [...new Set(rows.map((row) => row.groupId).filter(Boolean))];
}

export function canUserListDocument(
  user: AuthUser,
  doc: Pick<MongoDocument, 'ownerUserId' | 'access'>,
  memberGroupIds: string[],
): boolean {
  if (isDocumentAdmin(user)) return true;
  if (doc.ownerUserId && doc.ownerUserId === user.id) return true;

  const viewGroups = doc.access?.viewGroupIds ?? [];
  if (userHasDocumentGroupAccess(viewGroups, memberGroupIds)) return true;

  const downloadGroups = doc.access?.downloadGroupIds ?? [];
  if (userHasDocumentGroupAccess(downloadGroups, memberGroupIds)) return true;

  return false;
}
