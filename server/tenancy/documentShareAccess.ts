import type { AuthUser } from '../auth/types.js';
import type { MongoDocument, MongoDocumentShareGrant } from '../db/types.js';
import type { DocumentAccessPermissions } from './documentAccess.js';
import type { GovernanceAccessIndex } from './governanceAccessIndex.js';
import {
  canUserListDocument,
  isDocumentAdmin,
  resolveDocumentPermissions,
  userHasDocumentGroupAccess,
} from './documentAccess.js';
import { userHasGovernanceCategoryPermission } from './governanceAccessIndex.js';

export type DocumentAccessPermissionsWithShare = DocumentAccessPermissions & {
  canShare: boolean;
  sharedViaGrant: boolean;
};

function isShareGrantActive(grant: MongoDocumentShareGrant | null | undefined): grant is MongoDocumentShareGrant {
  if (!grant || grant.status !== 'active') return false;
  if (grant.expiresAt && grant.expiresAt.getTime() <= Date.now()) return false;
  return true;
}

export function canUserShareDocument(
  user: AuthUser,
  doc: Pick<MongoDocument, 'ownerUserId' | 'access' | 'classId'>,
  memberGroupIds: string[],
  governanceIndex?: GovernanceAccessIndex,
): boolean {
  if (isDocumentAdmin(user)) return true;
  if (doc.ownerUserId && doc.ownerUserId === user.id) return true;

  const shareGroups = doc.access?.shareGroupIds ?? [];
  if (userHasDocumentGroupAccess(shareGroups, memberGroupIds)) return true;
  if (userHasGovernanceCategoryPermission(governanceIndex, doc.classId, memberGroupIds, 'share')) {
    return true;
  }

  return resolveDocumentPermissions(user, doc, memberGroupIds, governanceIndex).canUpdate;
}

export function canUserListDocumentWithShare(
  user: AuthUser,
  doc: Pick<MongoDocument, 'ownerUserId' | 'access' | 'classId'>,
  memberGroupIds: string[],
  shareGrant?: MongoDocumentShareGrant | null,
  governanceIndex?: GovernanceAccessIndex,
): boolean {
  if (canUserListDocument(user, doc, memberGroupIds, governanceIndex)) return true;
  return isShareGrantActive(shareGrant) && shareGrant.permissions.canView === true;
}

export function resolveDocumentPermissionsWithShare(
  user: AuthUser,
  doc: Pick<MongoDocument, 'ownerUserId' | 'access' | 'classId'>,
  memberGroupIds: string[],
  shareGrant?: MongoDocumentShareGrant | null,
  governanceIndex?: GovernanceAccessIndex,
): DocumentAccessPermissionsWithShare {
  const base = resolveDocumentPermissions(user, doc, memberGroupIds, governanceIndex);
  const canShare = canUserShareDocument(user, doc, memberGroupIds, governanceIndex);

  if (!isShareGrantActive(shareGrant)) {
    return {
      ...base,
      canShare,
      sharedViaGrant: false,
    };
  }

  const sharePerms = shareGrant.permissions;
  const sharedViaGrant = !base.canPreview && !base.canDownload && sharePerms.canView;

  return {
    canPreview: base.canPreview || sharePerms.canView === true,
    canDownload: base.canDownload || sharePerms.canDownload === true,
    canEditMetadata: base.canEditMetadata,
    canUpdate: base.canUpdate,
    canTrash: base.canTrash,
    canContribute: base.canContribute,
    canTransferOwnership: base.canTransferOwnership,
    canShare: canShare && sharePerms.canShare === true,
    sharedViaGrant,
  };
}
