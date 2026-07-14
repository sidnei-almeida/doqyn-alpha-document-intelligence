import { nanoid } from 'nanoid';
import { createHash } from 'node:crypto';
import type { TenantStorageScope } from '../tenancy/resolveTenantStorageScope.js';
import { isMongoNativeConfigured } from '../db/mongoClient.js';
import type { MongoDocument, MongoDocumentVersion, MongoVersionMetadataField } from '../db/types.js';
import {
  buildDocumentSearchOrClause,
  buildDocumentTypeClause,
  resolveDocumentListSort,
} from '../utils/documentListQuery.js';
import { getTenantCollections } from '../tenancy/getTenantCollections.js';
import {
  assertCanAccessDocument,
  tenantScopeFilterFromContext,
  withTenantFieldsFromContext,
} from '../tenancy/tenantQuery.js';
import { ServiceError } from '../utils/serviceErrors.js';
import { sanitizeAuditMetadata } from '../utils/sanitizeAuditMetadata.js';
import { createDocumentAuditLog } from '../audit/documentAuditLogService.js';
import { buildDocumentNameSnapshot } from '../audit/documentNameSnapshot.js';
import { createProcessingJob } from './processingService.js';
import { storeUploadedDocumentFile } from './documentFileService.js';
import { resolveStorageFileNames } from '../utils/resolveStorageFileNames.js';
import type { AuthUser } from '../auth/types.js';
import type { MongoPreviewStorageSlot } from '../db/types.js';
import {
  loadMemberDocumentGroupIds,
} from '../tenancy/documentAccess.js';
import { canViewDocumentTracking } from '../auth/permissions.js';
import { logger } from '../utils/logger.js';
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
import { buildInitialDocumentOwnershipFields } from '../utils/documentMutationFields.js';

/** Stub legado do upload simulado — pipeline real usa analyze/confirm. */
async function extractMetadata(input: {
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  documentType: string;
}) {
  return {
    fileName: input.originalFileName,
    mimeType: input.mimeType,
    fileSize: input.fileSize,
    documentType: input.documentType,
    extractedAt: new Date().toISOString(),
    fields: {
      detectedLanguage: 'pt-BR',
      pageCount: input.mimeType === 'application/pdf' ? 3 : 1,
    },
  };
}

async function classifyDocument(
  documentType: string,
  metadata: Record<string, unknown>,
) {
  const categoryMap: Record<string, string> = {
    Contrato: 'legal',
    'Nota Fiscal': 'financial',
    Relatório: 'report',
    'Política Interna': 'policy',
    Comprovante: 'receipt',
  };

  return {
    category: categoryMap[documentType] ?? 'general',
    confidence: 0.92,
    metadata,
  };
}

export type DocumentListItemPermissions = {
  canPreview: boolean;
  canDownload: boolean;
  canViewTracking: boolean;
  canEditMetadata: boolean;
  canUpdate: boolean;
};

export interface UploadInput {
  tenantId: string;
  ownerUserId: string;
  ownerName: string;
  originalFileName: string;
  displayName: string;
  documentType: string;
  accessGroups: string[];
  notes?: string;
  fileSize: number;
  mimeType: string;
  fileBuffer?: Buffer;
  storageScope?: TenantStorageScope;
}

function requireTenantId(tenantId?: string): string {
  if (!tenantId?.trim()) {
    throw new ServiceError('tenantId é obrigatório.', 'TENANT_REQUIRED', 400);
  }
  return tenantId.trim();
}

export async function uploadDocument(input: UploadInput) {
  const tenantId = requireTenantId(input.tenantId);
  const hash = input.fileBuffer
    ? createHash('sha256').update(input.fileBuffer).digest('hex')
    : `sim-${nanoid(16)}`;

  const area = input.accessGroups[0] ?? 'Geral';
  const versionId = nanoid();
  const documentId = nanoid();
  const ownershipFields = buildInitialDocumentOwnershipFields({
    ownerUserId: input.ownerUserId,
    ownerName: input.ownerName,
  });
  const now = ownershipFields.createdAt;

  if (!isMongoNativeConfigured()) {
    logger.info('Upload simulado (sem MongoDB)', { fileName: input.originalFileName });
    const simulatedDoc = {
      id: documentId,
      tenantId,
      originalFileName: input.originalFileName,
      displayName: input.displayName,
      documentType: input.documentType,
      status: 'analyzing' as const,
      version: 1,
      currentVersionId: versionId,
      ownerUserId: input.ownerUserId,
      ownerName: input.ownerName,
      area,
      accessGroups: input.accessGroups,
      metadata: await extractMetadata(input),
      processingStatus: 'in_progress' as const,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    return { document: simulatedDoc, versionId };
  }

  const { documents, documentVersions, storage } = await getTenantCollections(tenantId, {
    userId: input.ownerUserId,
  });
  const metadata = await extractMetadata(input);
  const classification = await classifyDocument(input.documentType, metadata);

  const resolvedNames = resolveStorageFileNames({
    originalFileName: input.originalFileName,
    aiSuggestedFileName: input.displayName,
    namingMode: 'original',
    finalFileName: input.displayName !== input.originalFileName ? input.displayName : undefined,
    documentId,
    versionLabel: 'v1.0',
  });

  const skippedPreviewSlot: MongoDocumentVersion['storage']['preview'] = {
    provider: 'cloudflare_r2',
    status: 'skipped',
    bucketAlias: null,
    objectKey: null,
    errorCode: 'PREVIEW_NOT_GENERATED',
    errorMessage: 'Preview não gerado no upload legado.',
  };

  const document = withTenantFieldsFromContext(
    storage,
    {
    _id: documentId,
    documentCode: `UP-${documentId.slice(0, 8).toUpperCase()}`,
    originalFileName: input.originalFileName,
    displayName: input.displayName,
    documentType: input.documentType,
    title: resolvedNames.finalFileName,
    currentFileName: resolvedNames.finalFileName,
    classId: 'unclassified',
    className: input.documentType,
    status: 'active',
    processingStatus: 'pending',
    version: 1,
    currentVersionId: versionId,
    currentVersionLabel: 'v1.0',
    versionCount: 1,
    ownerUserId: ownershipFields.ownerUserId,
    ownerName: ownershipFields.ownerName,
    area,
    accessGroups: input.accessGroups,
    access: {
      viewGroupIds: input.accessGroups,
      downloadGroupIds: input.accessGroups,
      updateGroupIds: input.accessGroups,
      auditGroupIds: input.accessGroups,
      shareGroupIds: input.accessGroups,
    },
    currentMetadataPreview: {},
    metadata: { ...metadata, classification },
    processingStatusLegacy: 'in_progress',
    createdBy: ownershipFields.createdBy,
    updatedBy: ownershipFields.updatedBy,
    updatedByName: ownershipFields.updatedByName,
    createdAt: ownershipFields.createdAt,
    updatedAt: ownershipFields.updatedAt,
  },
    input.ownerUserId,
  );

  await documents.insertOne(document as unknown as MongoDocument);

  let versionStorage: MongoDocumentVersion['storage'] = {
    primary: { provider: 'aws_s3', status: 'pending', objectKey: null, bucketAlias: null, storedAt: null },
    backup: { provider: 'cloudflare_r2', status: 'pending', objectKey: null, bucketAlias: null, storedAt: null },
  };

  if (input.fileBuffer && input.fileBuffer.length > 0) {
    try {
      versionStorage = await storeUploadedDocumentFile({
        tenantId,
        documentId,
        versionId,
        buffer: input.fileBuffer,
        mimeType: input.mimeType,
        originalFileName: input.originalFileName,
        storageFileName: resolvedNames.storageFileName,
        storageScope: input.storageScope,
      });
    } catch (error) {
      await documents.deleteOne({ _id: documentId } as Record<string, unknown>);
      throw error;
    }
  }

  versionStorage = {
    ...versionStorage,
    preview: skippedPreviewSlot,
  };

  const version = withTenantFieldsFromContext(
    storage,
    {
    _id: versionId,
    documentId,
    versionNumber: 1,
    versionLabel: 'v1.0',
    previousVersionId: null,
    originalFileName: input.originalFileName,
    recommendedFileName: resolvedNames.aiSuggestedFileName || input.displayName,
    aiSuggestedFileName: resolvedNames.aiSuggestedFileName || input.displayName,
    finalFileName: resolvedNames.finalFileName,
    namingMode: resolvedNames.namingMode,
    storageFileName: resolvedNames.storageFileName,
    previewStorageFileName: resolvedNames.previewStorageFileName,
    selectedFileName: resolvedNames.selectedFileName,
    file: {
      mimeType: input.mimeType,
      extension: input.originalFileName.split('.').pop() ?? '',
      sizeBytes: input.fileSize,
      sha256: hash,
    },
    classification: {
      classId: 'unclassified',
      className: input.documentType,
      confidence: 0,
      requiresReview: true,
      reason: 'upload_legacy',
    },
    rule: { ruleId: 'none', ruleVersion: 0 },
    metadata: {},
    metadataIndex: [],
    storage: versionStorage,
    review: { required: true, reasons: ['upload_legacy'], reviewedBy: null, reviewedAt: null },
    changeNotes: input.notes,
    uploadedBy: input.ownerName,
    createdBy: input.ownerUserId,
    createdAt: now,
    updatedAt: now,
  },
    input.ownerUserId,
  );

  await documentVersions.insertOne(version as unknown as MongoDocumentVersion);

  const uploadNameSnapshot = buildDocumentNameSnapshot({
    finalFileName: input.displayName,
    originalFileName: input.displayName,
  });

  await createDocumentAuditLog(
    {
      tenantId,
      tenantType: storage.tenantType === 'individual' ? 'individual' : 'business',
      collectionPrefix: storage.collectionPrefix,
      ownerTenantId: storage.tenantId,
      ownerUserId: input.ownerUserId,
      actorUserId: input.ownerUserId,
      actorDisplayName: input.ownerName,
    },
    {
      action: 'document.upload_completed',
      description: `${input.displayName} enviado para análise`,
      documentId,
      versionId,
      area,
      target: {
        type: 'document',
        id: documentId,
        nameSnapshot: uploadNameSnapshot,
      },
      metadata: sanitizeAuditMetadata({
        documentName: uploadNameSnapshot,
        mimeType: input.mimeType,
        sizeBytes: input.fileSize,
        checksumSha256: hash,
        source: 'upload_legacy',
      }),
      occurredAt: now,
    },
  );

  await createProcessingJob({
    tenantId,
    documentId,
    versionId,
    ownerUserId: input.ownerUserId,
  });

  return {
    document: {
      id: documentId,
      tenantId,
      originalFileName: input.originalFileName,
      displayName: input.displayName,
      documentType: input.documentType,
      status: 'analyzing',
      version: 1,
      currentVersionId: versionId,
      ownerUserId: input.ownerUserId,
      ownerName: input.ownerName,
      area,
      accessGroups: input.accessGroups,
      metadata: { ...metadata, classification },
      processingStatus: 'in_progress',
      createdAt: now,
      updatedAt: now,
    },
    versionId,
  };
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
  const flat: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(metadata)) {
    flat[field.label?.trim() || key] = field.value ?? field.normalizedValue ?? null;
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
    canViewTracking: canViewDocumentTracking(user),
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

  return {
    document,
    latestVersion,
    versions: mappedVersions,
    metadata:
      Object.keys(versionMetadata).length > 0
        ? versionMetadata
        : ((record.metadata as Record<string, unknown> | undefined) ?? {}),
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
