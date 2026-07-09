import type { AuthUser } from '../auth/types.js';
import { canViewDocumentTracking } from '../auth/permissions.js';
import type { MongoDocument, MongoDocumentShareGrant, MongoPreviewStorageSlot } from '../db/types.js';
import {
  loadMemberDocumentGroupIds,
} from '../tenancy/documentAccess.js';
import {
  canUserListDocumentWithShare,
  resolveDocumentPermissionsWithShare,
} from '../tenancy/documentShareAccess.js';
import { getTenantCollections } from '../tenancy/getTenantCollections.js';
import { normalizeVersionLabel } from '../utils/versionLabelUtils.js';

export type DocumentListItemPermissions = {
  canPreview: boolean;
  canDownload: boolean;
  canViewTracking: boolean;
  canEditMetadata: boolean;
  canUpdate: boolean;
  canShare?: boolean;
  sharedViaGrant?: boolean;
};

function mapPreviewStatus(
  preview?: MongoPreviewStorageSlot | null,
): 'ready' | 'failed' | 'skipped' | 'missing' {
  if (!preview) return 'missing';
  if (preview.status === 'ready') return 'ready';
  if (preview.status === 'failed') return 'failed';
  if (
    preview.status === 'skipped' ||
    preview.status === 'pending' ||
    preview.status === 'processing'
  ) {
    return 'skipped';
  }
  return 'missing';
}

function mapDocumentListItem(
  doc: MongoDocument,
  versionMeta?: {
    versionLabel?: string;
    preview?: MongoPreviewStorageSlot | null;
    hasOriginal?: boolean;
    hasPreview?: boolean;
  },
  permissions?: DocumentListItemPermissions,
) {
  const record = doc as Record<string, unknown>;
  return {
    documentId: String(doc._id),
    id: String(doc._id),
    tenantId: doc.tenantId ?? doc.companyId,
    currentFileName: doc.currentFileName ?? doc.title,
    categoryId: doc.classId,
    categoryName: doc.className ?? (record.documentType as string | undefined),
    status: doc.status,
    latestVersionId: doc.currentVersionId,
    currentVersionId: doc.currentVersionId,
    versionLabel: versionMeta?.versionLabel,
    currentVersionLabel: versionMeta?.versionLabel,
    originalFileName: (record.originalFileName as string | undefined) ?? doc.currentFileName,
    displayName:
      (record.displayName as string | undefined) ?? doc.title ?? doc.currentFileName,
    documentType: (record.documentType as string | undefined) ?? doc.className,
    version: (record.version as number | undefined) ?? (record.versionCount as number | undefined) ?? 1,
    versionCount: (record.versionCount as number | undefined) ?? (record.version as number | undefined) ?? 1,
    ownerUserId: doc.ownerUserId,
    ownerName: (record.ownerName as string | undefined),
    area: (record.area as string | undefined),
    accessGroups: (record.accessGroups as string[] | undefined) ?? doc.access?.viewGroupIds,
    metadata: record.metadata,
    processingStatus: doc.processingStatus ?? (record.processingStatusLegacy as string | undefined),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    createdBy: {
      userId: doc.ownerUserId,
      displayName: (record.ownerName as string | undefined) ?? undefined,
      email: undefined,
    },
    preview: {
      status: mapPreviewStatus(versionMeta?.preview),
    },
    storage: {
      hasOriginal: versionMeta?.hasOriginal ?? false,
      hasPreview: versionMeta?.hasPreview ?? false,
    },
    permissions: permissions ?? {
      canPreview: true,
      canDownload: true,
      canViewTracking: false,
      canEditMetadata: false,
      canUpdate: false,
    },
  };
}

export async function buildDocumentListItems(input: {
  tenantId: string;
  docs: MongoDocument[];
  user?: AuthUser;
  ownerUserId?: string;
  membershipId?: string;
  memberGroupIds?: string[];
  shareGrantsByDocumentId?: Map<string, MongoDocumentShareGrant>;
}) {
  const { tenantId, docs, user, ownerUserId, membershipId } = input;

  const memberGroupIds =
    input.memberGroupIds ??
    (user && ownerUserId
      ? await loadMemberDocumentGroupIds({ tenantId, userId: ownerUserId, membershipId })
      : []);

  const versionIds = docs
    .map((doc) => doc.currentVersionId)
    .filter((id): id is string => Boolean(id));

  const versionMap = new Map<
    string,
    {
      preview: MongoPreviewStorageSlot | null;
      versionLabel?: string;
      hasOriginal: boolean;
      hasPreview: boolean;
    }
  >();

  if (versionIds.length) {
    const { documentVersions } = await getTenantCollections(tenantId, {
      userId: ownerUserId,
      membershipId,
    });
    const versions = await documentVersions
      .find({ _id: { $in: versionIds } } as Record<string, unknown>)
      .project({ storage: 1, versionLabel: 1 })
      .toArray();

    for (const version of versions) {
      const primary = version.storage?.primary;
      const preview = version.storage?.preview ?? null;
      versionMap.set(String(version._id), {
        preview,
        versionLabel: version.versionLabel,
        hasOriginal: primary?.status === 'stored' && Boolean(primary.objectKey),
        hasPreview: preview?.status === 'ready' && Boolean(preview.objectKey),
      });
    }
  }

  const visibleDocs = user
    ? docs.filter((doc) =>
        canUserListDocumentWithShare(
          user,
          doc,
          memberGroupIds,
          input.shareGrantsByDocumentId?.get(String(doc._id)),
        ),
      )
    : docs;

  return visibleDocs.map((doc) => {
    const shareGrant = input.shareGrantsByDocumentId?.get(String(doc._id));
    const perms = user
      ? resolveDocumentPermissionsWithShare(user, doc, memberGroupIds, shareGrant)
      : { canPreview: true, canDownload: true, canEditMetadata: false, canUpdate: false, canShare: false, sharedViaGrant: false };
    const permissions: DocumentListItemPermissions = {
      canPreview: perms.canPreview,
      canDownload: perms.canDownload,
      canEditMetadata: perms.canEditMetadata,
      canUpdate: perms.canUpdate,
      canShare: perms.canShare,
      sharedViaGrant: perms.sharedViaGrant,
      canViewTracking: user ? canViewDocumentTracking(user) : false,
    };
    const docRecord = doc as Record<string, unknown>;
    const versionMetaFromDoc = versionMap.get(doc.currentVersionId ?? '');
    const versionLabel =
      versionMetaFromDoc?.versionLabel ??
      normalizeVersionLabel(
        (docRecord.currentVersionLabel as string | undefined) ??
          versionMetaFromDoc?.versionLabel,
      );
    return mapDocumentListItem(
      doc,
      versionMetaFromDoc
        ? { ...versionMetaFromDoc, versionLabel }
        : { versionLabel, hasOriginal: false, hasPreview: false, preview: null },
      permissions,
    );
  });
}
