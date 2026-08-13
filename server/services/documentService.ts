import { isMongoNativeConfigured } from '../db/mongoClient.js';
import type { MongoDocument, MongoVersionMetadataField } from '../db/types.js';
import {
  buildDocumentSearchOrClause,
  buildDocumentTypeClause,
  resolveDocumentListSort,
} from '../utils/documentListQuery.js';
import { getTenantCollections } from '../tenancy/getTenantCollections.js';
import {
  assertCanAccessDocument,
  tenantScopeFilterFromContext,
} from '../tenancy/tenantQuery.js';
import { ServiceError } from '../utils/serviceErrors.js';
import type { AuthUser } from '../auth/types.js';
import type { MongoPreviewStorageSlot } from '../db/types.js';
import {
  loadMemberDocumentGroupIds,
} from '../tenancy/documentAccess.js';
import { canViewDocumentTracking } from '../auth/permissions.js';
import { buildDocumentListItems } from './documentListItems.js';
import {
  loadDocumentSignatureSummary,
} from './signatures/documentSignatureSummaryService.js';
import {
  attachFavoriteFlags,
  lookupFavoriteFlags,
} from './favorites/documentFavoritesService.js';
import { normalizeVersionLabel } from '../utils/versionLabelUtils.js';
import { resolveDocumentAccessWithShare } from './sharing/documentShareService.js';
import { dedupeMetadataRecord } from '../../shared/metadataKeyNormalize.js';

export type DocumentListItemPermissions = {
  canPreview: boolean;
  canDownload: boolean;
  canViewTracking: boolean;
  canEditMetadata: boolean;
  canUpdate: boolean;
};

function requireTenantId(tenantId?: string): string {
  if (!tenantId?.trim()) {
    throw new ServiceError('tenantId é obrigatório.', 'TENANT_REQUIRED', 400);
  }
  return tenantId.trim();
}

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

function flattenVersionMetadata(
  metadata?: Record<string, MongoVersionMetadataField>,
): Record<string, unknown> {
  if (!metadata) return {};
  // Mantém chaves canônicas (snake_case). Usar label como chave gerava duplicatas
  // ("Parte Reveladora" vs parte_reveladora) na comparação de versões.
  const canonical = dedupeMetadataRecord(metadata);
  const flat: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(canonical)) {
    flat[key] = field.value ?? field.normalizedValue ?? null;
  }
  return flat;
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

export async function listDocuments(filters: {
  tenantId?: string;
  ownerUserId?: string;
  membershipId?: string;
  user?: AuthUser;
  search?: string;
  status?: string;
  processingStatus?: string;
  type?: string;
  area?: string;
  categoryId?: string;
  from?: string;
  to?: string;
  sort?: string;
  direction?: string;
  owner?: string;
  excludeArchived?: boolean | string;
  cursor?: string;
  limit?: number;
}) {
  const tenantId = requireTenantId(filters.tenantId);

  if (!isMongoNativeConfigured()) {
    return { documents: [], items: [], total: 0, pagination: { nextCursor: null } };
  }

  const { documents, storage } = await getTenantCollections(tenantId, {
    userId: filters.ownerUserId,
  });
  const query: Record<string, unknown> = {
    ...tenantScopeFilterFromContext(storage),
    deletedAt: { $in: [null, undefined] },
    permanentlyDeletedAt: { $in: [null, undefined] },
    deactivatedAt: { $in: [null, undefined] },
  };
  if (filters.status) query.status = filters.status;
  if (filters.processingStatus) {
    if (filters.processingStatus === 'processed') {
      query.processingStatus = { $in: ['processed', 'processed_with_review'] };
    } else {
      query.processingStatus = filters.processingStatus;
    }
  }
  if (filters.area) query.area = filters.area;
  if (filters.categoryId) query.classId = filters.categoryId;

  if (filters.excludeArchived === true || filters.excludeArchived === 'true') {
    if (!filters.status) {
      query.status = { $ne: 'archived' };
    }
  }

  if (filters.owner === 'me' && filters.ownerUserId) {
    query.ownerUserId = filters.ownerUserId;
  } else if (filters.owner === 'others' && filters.ownerUserId) {
    query.ownerUserId = { $ne: filters.ownerUserId };
  }

  const andClauses: Record<string, unknown>[] = [];

  if (filters.search?.trim()) {
    andClauses.push({ $or: buildDocumentSearchOrClause(filters.search) });
  }

  if (filters.type) {
    const typeClause = buildDocumentTypeClause(filters.type);
    if (typeClause) andClauses.push(typeClause);
  }

  if (andClauses.length === 1) {
    Object.assign(query, andClauses[0]);
  } else if (andClauses.length > 1) {
    query.$and = andClauses;
  }

  if (filters.from?.trim() || filters.to?.trim()) {
    const updatedAt: Record<string, Date> = {};
    if (filters.from?.trim()) {
      updatedAt.$gte = new Date(filters.from.trim());
    }
    if (filters.to?.trim()) {
      updatedAt.$lte = new Date(filters.to.trim());
    }
    query.updatedAt = updatedAt;
  }

  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
  const { field, direction } = resolveDocumentListSort(filters.sort, filters.direction);

  const docs = await documents
    .find(query)
    .sort({ [field]: direction })
    .limit(limit)
    .toArray();
  const memberGroupIds =
    filters.user && filters.ownerUserId
      ? await loadMemberDocumentGroupIds({
          tenantId,
          userId: filters.ownerUserId,
          membershipId: filters.membershipId,
        })
      : [];

  const items = await buildDocumentListItems({
    tenantId,
    docs: docs as MongoDocument[],
    user: filters.user,
    ownerUserId: filters.ownerUserId,
    membershipId: filters.membershipId,
    memberGroupIds,
  });

  const { activeIds } = await lookupFavoriteFlags(
    filters.ownerUserId,
    items.map((item) => item.documentId),
  );
  const itemsWithFavorites = attachFavoriteFlags(items, activeIds);

  return {
    items: itemsWithFavorites,
    documents: itemsWithFavorites,
    total: itemsWithFavorites.length,
    pagination: {
      nextCursor: null,
    },
  };
}

export async function getDocumentDetail(
  id: string,
  tenantId: string | undefined,
  ownerUserId: string | undefined,
  user: AuthUser,
  membershipId?: string,
) {
  const resolvedTenantId = requireTenantId(tenantId);

  if (!isMongoNativeConfigured()) return null;

  const { documents, documentVersions, storage } = await getTenantCollections(resolvedTenantId, {
    userId: ownerUserId,
    membershipId,
  });
  const doc = await documents.findOne({
    _id: id,
    ...tenantScopeFilterFromContext(storage),
  } as Record<string, unknown>);

  if (!doc) return null;

  assertCanAccessDocument(doc as Record<string, unknown>, storage);

  const { permissions: perms } = await resolveDocumentAccessWithShare({
    user,
    doc: doc as MongoDocument,
    sharedWithUserId: user.id,
    tenantId: resolvedTenantId,
    membershipId,
  });
  const permissions = {
    canPreview: perms.canPreview,
    canDownload: perms.canDownload,
    canEditMetadata: perms.canEditMetadata,
    canUpdate: perms.canUpdate,
    canTransferOwnership: perms.canTransferOwnership,
    canViewTracking: canViewDocumentTracking(user, {
      ownerUserId: (doc as MongoDocument).ownerUserId,
    }),
    canShare: perms.canShare,
    sharedViaGrant: perms.sharedViaGrant,
  };

  if (!permissions.canPreview && !permissions.canDownload) {
    throw new ServiceError(
      'Você não tem permissão para visualizar este documento.',
      'DOCUMENT_ACCESS_DENIED',
      403,
    );
  }

  const versions = await documentVersions
    .find({
      documentId: id,
      ...tenantScopeFilterFromContext(storage),
    } as Record<string, unknown>)
    .sort({ createdAt: -1 })
    .toArray();

  const mappedVersions = versions.map((version) => ({
    versionId: String(version._id),
    versionLabel: normalizeVersionLabel(version.versionLabel),
    finalFileName: version.finalFileName ?? version.originalFileName,
    originalFileName: version.originalFileName,
    createdAt: version.createdAt,
    previewStatus: mapPreviewStatus(version.storage?.preview ?? null),
    preview: {
      status: mapPreviewStatus(version.storage?.preview ?? null),
    },
  }));

  const latestVersionRaw =
    versions.find((version) => String(version._id) === doc.currentVersionId) ?? versions[0] ?? null;

  const latestVersion = latestVersionRaw
    ? {
        versionId: String(latestVersionRaw._id),
        versionLabel: normalizeVersionLabel(latestVersionRaw.versionLabel),
        finalFileName: latestVersionRaw.finalFileName ?? latestVersionRaw.originalFileName,
        storageFileName: latestVersionRaw.storageFileName ?? latestVersionRaw.finalFileName,
        previewStorageFileName:
          latestVersionRaw.previewStorageFileName ??
          (latestVersionRaw.finalFileName
            ? `${latestVersionRaw.finalFileName.replace(/\.pdf$/i, '')}_preview.pdf`
            : undefined),
        previewStatus: mapPreviewStatus(latestVersionRaw.storage?.preview ?? null),
        originalFileName: latestVersionRaw.originalFileName,
        createdAt: latestVersionRaw.createdAt,
        preview: {
          status: mapPreviewStatus(latestVersionRaw.storage?.preview ?? null),
        },
      }
    : mappedVersions[0] ?? null;

  const latestPreview = latestVersionRaw?.storage?.preview ?? null;
  const latestPrimary = latestVersionRaw?.storage?.primary;

  const document = {
    ...mapDocumentListItem(
      doc as MongoDocument,
      latestVersionRaw
        ? {
            versionLabel: normalizeVersionLabel(latestVersionRaw.versionLabel),
            preview: latestPreview,
            hasOriginal: latestPrimary?.status === 'stored' && Boolean(latestPrimary.objectKey),
            hasPreview: latestPreview?.status === 'ready' && Boolean(latestPreview.objectKey),
          }
        : undefined,
      permissions,
    ),
    signatureSummary: await loadDocumentSignatureSummary(resolvedTenantId, id),
  };

  const record = doc as Record<string, unknown>;
  const versionMetadata = latestVersionRaw
    ? flattenVersionMetadata(latestVersionRaw.metadata)
    : {};

  const rawSearchMeta = (doc as MongoDocument).searchMeta;
  const searchMeta = rawSearchMeta
    ? {
        people: rawSearchMeta.people ?? [],
        dates: (rawSearchMeta.dates ?? []).map((entry) => ({
          kind: entry.kind,
          date: entry.date instanceof Date ? entry.date.toISOString() : String(entry.date),
          sourceKey: entry.sourceKey,
          label: entry.label,
        })),
        documentTitle: rawSearchMeta.documentTitle ?? null,
        validityDate: rawSearchMeta.validityDate
          ? rawSearchMeta.validityDate instanceof Date
            ? rawSearchMeta.validityDate.toISOString()
            : String(rawSearchMeta.validityDate)
          : null,
      }
    : null;

  return {
    document,
    latestVersion,
    versions: mappedVersions,
    metadata:
      Object.keys(versionMetadata).length > 0
        ? versionMetadata
        : ((record.metadata as Record<string, unknown> | undefined) ?? {}),
    searchMeta,
    permissions,
  };
}

export async function getDocument(id: string, tenantId?: string, ownerUserId?: string) {
  const resolvedTenantId = requireTenantId(tenantId);

  if (!isMongoNativeConfigured()) return null;

  const { documents, storage } = await getTenantCollections(resolvedTenantId, {
    userId: ownerUserId,
  });
  const doc = await documents.findOne({
    _id: id,
    ...tenantScopeFilterFromContext(storage),
  } as Record<string, unknown>);

  if (!doc) return null;

  assertCanAccessDocument(doc as Record<string, unknown>, storage);

  return {
    id: String(doc._id),
    tenantId: doc.tenantId ?? doc.companyId,
    originalFileName: (doc as Record<string, unknown>).originalFileName as string | undefined ?? doc.currentFileName,
    displayName: (doc as Record<string, unknown>).displayName as string | undefined ?? doc.title,
    documentType: (doc as Record<string, unknown>).documentType as string | undefined ?? doc.className,
    status: doc.status,
    version: (doc as Record<string, unknown>).version as number | undefined ?? 1,
    currentVersionId: doc.currentVersionId,
    ownerUserId: doc.ownerUserId,
    ownerName: (doc as Record<string, unknown>).ownerName as string | undefined,
    area: (doc as Record<string, unknown>).area as string | undefined,
    accessGroups: (doc as Record<string, unknown>).accessGroups as string[] | undefined ?? doc.access?.viewGroupIds,
    metadata: (doc as Record<string, unknown>).metadata,
    processingStatus: doc.processingStatus ?? (doc as Record<string, unknown>).processingStatusLegacy,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
