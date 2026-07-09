import type { AuthUser } from '../auth/types.js';
import type { MongoDocument, MongoDocumentShareGrant } from '../db/types.js';
import type { DocumentAccessPermissions } from './documentAccess.js';
import {
  canUserListDocument,
  isDocumentAdmin,
  resolveDocumentPermissions,
  userHasDocumentGroupAccess,
} from './documentAccess.js';

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
  doc: Pick<MongoDocument, 'ownerUserId' | 'access'>,
  memberGroupIds: string[],
): boolean {
  if (isDocumentAdmin(user)) return true;
  if (doc.ownerUserId && doc.ownerUserId === user.id) return true;

  const shareGroups = doc.access?.shareGroupIds ?? [];
  if (userHasDocumentGroupAccess(shareGroups, memberGroupIds)) return true;

  return resolveDocumentPermissions(user, doc, memberGroupIds).canUpdate;
}

export function canUserListDocumentWithShare(
  user: AuthUser,
  doc: Pick<MongoDocument, 'ownerUserId' | 'access'>,
  memberGroupIds: string[],
  shareGrant?: MongoDocumentShareGrant | null,
): boolean {
  if (canUserListDocument(user, doc, memberGroupIds)) return true;
  return isShareGrantActive(shareGrant) && shareGrant.permissions.canView === true;
}

export function resolveDocumentPermissionsWithShare(
  user: AuthUser,
  doc: Pick<MongoDocument, 'ownerUserId' | 'access'>,
  memberGroupIds: string[],
  shareGrant?: MongoDocumentShareGrant | null,
): DocumentAccessPermissionsWithShare {
  const base = resolveDocumentPermissions(user, doc, memberGroupIds);
  const canShare = canUserShareDocument(user, doc, memberGroupIds);

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
    canShare: canShare && sharePerms.canShare === true,
    sharedViaGrant,
  };
}
