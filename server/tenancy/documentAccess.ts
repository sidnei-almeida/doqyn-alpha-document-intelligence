import type { AuthUser } from '../auth/types.js';
import { userHasRole } from '../auth/requireAuth.js';
import { getTenantCollections } from './getTenantCollections.js';
import { tenantScopeFilterFromContext } from './tenantQuery.js';
import { ServiceError } from '../utils/serviceErrors.js';
import type { MongoDocument } from '../db/types.js';
import {
  type GovernanceAccessIndex,
  userHasGovernanceCategoryPermission,
  loadGovernanceAccessIndex,
} from './governanceAccessIndex.js';

export type DocumentAccessPermissions = {
  canPreview: boolean;
  canDownload: boolean;
  canEditMetadata: boolean;
  canUpdate: boolean;
  canTrash: boolean;
  canContribute: boolean;
  canTransferOwnership: boolean;
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
  doc: Pick<MongoDocument, 'ownerUserId' | 'access' | 'classId'>,
  memberGroupIds: string[],
  governanceIndex?: GovernanceAccessIndex,
): DocumentAccessPermissions {
  const isAdmin = isDocumentAdmin(user);
  const isOwner = Boolean(doc.ownerUserId && doc.ownerUserId === user.id);
  const viewGroups = doc.access?.viewGroupIds ?? [];
  const downloadGroups = doc.access?.downloadGroupIds ?? [];
  const updateGroups = doc.access?.updateGroupIds ?? [];

  const canPreview =
    isAdmin ||
    isOwner ||
    userHasDocumentGroupAccess(viewGroups, memberGroupIds) ||
    userHasGovernanceCategoryPermission(governanceIndex, doc.classId, memberGroupIds, 'view');

  const canDownload =
    isAdmin ||
    isOwner ||
    userHasDocumentGroupAccess(downloadGroups, memberGroupIds) ||
    userHasGovernanceCategoryPermission(governanceIndex, doc.classId, memberGroupIds, 'download');

  const canContribute =
    isAdmin ||
    userHasDocumentGroupAccess(updateGroups, memberGroupIds) ||
    userHasGovernanceCategoryPermission(governanceIndex, doc.classId, memberGroupIds, 'upload');

  const canUpdate = isAdmin;
  const canTrash = isAdmin;
  const canTransferOwnership = isAdmin || isOwner;

  return {
    canPreview,
    canDownload,
    canEditMetadata: isAdmin,
    canUpdate,
    canTrash,
    canContribute,
    canTransferOwnership,
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

export function assertCanUpdateDocument(permissions: DocumentAccessPermissions): void {
  if (!permissions.canUpdate) {
    throw new ServiceError(
      'Você não tem permissão para atualizar este documento.',
      'DOCUMENT_UPDATE_DENIED',
      403,
    );
  }
}

export function canUserTrashDocument(
  user: AuthUser,
  doc: Pick<MongoDocument, 'ownerUserId' | 'access' | 'classId'>,
  memberGroupIds: string[],
  governanceIndex?: GovernanceAccessIndex,
): boolean {
  return resolveDocumentPermissions(user, doc, memberGroupIds, governanceIndex).canTrash;
}

export function assertCanTrashDocument(
  user: AuthUser,
  doc: Pick<MongoDocument, 'ownerUserId' | 'access' | 'classId'>,
  memberGroupIds: string[],
  governanceIndex?: GovernanceAccessIndex,
): void {
  if (!canUserTrashDocument(user, doc, memberGroupIds, governanceIndex)) {
    throw new ServiceError(
      'Você não tem permissão para excluir este documento.',
      'DOCUMENT_TRASH_DENIED',
      403,
    );
  }
}

export function assertCanPermanentDeleteDocument(
  user: AuthUser,
  _doc: Pick<MongoDocument, 'ownerUserId' | 'access' | 'classId'>,
  _memberGroupIds: string[],
  _governanceIndex?: GovernanceAccessIndex,
): void {
  if (!isDocumentAdmin(user)) {
    throw new ServiceError(
      'Você não tem permissão para excluir permanentemente este documento.',
      'DOCUMENT_PERMANENT_DELETE_DENIED',
      403,
    );
  }
}

/** Admin+ pode listar e reativar documentos na seção Desativados. */
export function assertCanManageDeactivatedDocuments(user: AuthUser): void {
  if (!isDocumentAdmin(user)) {
    throw new ServiceError(
      'Somente administradores podem gerenciar documentos desativados.',
      'DOCUMENT_DEACTIVATED_ACCESS_DENIED',
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

export async function loadDocumentAccessContext(input: {
  tenantId: string;
  userId: string;
  membershipId?: string;
}): Promise<{
  memberGroupIds: string[];
  governanceIndex: GovernanceAccessIndex;
}> {
  const [memberGroupIds, governanceIndex] = await Promise.all([
    loadMemberDocumentGroupIds(input),
    loadGovernanceAccessIndex(input.tenantId, { ownerUserId: input.userId }),
  ]);

  return { memberGroupIds, governanceIndex };
}

export function canUserListDocument(
  user: AuthUser,
  doc: Pick<MongoDocument, 'ownerUserId' | 'access' | 'classId'>,
  memberGroupIds: string[],
  governanceIndex?: GovernanceAccessIndex,
): boolean {
  if (isDocumentAdmin(user)) return true;
  if (doc.ownerUserId && doc.ownerUserId === user.id) return true;

  const viewGroups = doc.access?.viewGroupIds ?? [];
  if (userHasDocumentGroupAccess(viewGroups, memberGroupIds)) return true;

  const downloadGroups = doc.access?.downloadGroupIds ?? [];
  if (userHasDocumentGroupAccess(downloadGroups, memberGroupIds)) return true;

  if (userHasGovernanceCategoryPermission(governanceIndex, doc.classId, memberGroupIds, 'view')) {
    return true;
  }

  if (
    userHasGovernanceCategoryPermission(governanceIndex, doc.classId, memberGroupIds, 'download')
  ) {
    return true;
  }

  return false;
}
