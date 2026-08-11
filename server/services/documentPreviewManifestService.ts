import type { AuthUser } from '../auth/types.js';
import { canViewDocumentTracking } from '../auth/permissions.js';
import type { MongoDocument, MongoDocumentVersion, MongoPreviewStorageSlot } from '../db/types.js';
import { isMongoNativeConfigured } from '../db/mongoClient.js';
import { renderPdfPageToPng } from '../preview/pdfPageRenderer.js';
import { getPdfPreviewConfig } from '../preview/previewConfig.js';
import {
  buildPdfPreviewManifestFromBuffer,
  isPreviewManifestUsable,
  saveVersionPreviewManifest,
  updatePreviewManifestPageCache,
} from '../preview/previewManifestPersistence.js';
import type { TenantStorageScope } from '../tenancy/resolveTenantStorageScope.js';
import {
  assertCanAccessDocument,
  buildDocumentOwnershipFilter,
  tenantScopeFilterFromContext,
} from '../tenancy/tenantQuery.js';
import {
  assertCanPreviewDocument,
  loadDocumentAccessContext,
} from '../tenancy/documentAccess.js';
import { resolveDocumentPermissionsWithShare } from '../tenancy/documentShareAccess.js';
import { findActiveShareGrantForUser } from './sharing/documentShareService.js';
import { getTenantCollections } from '../tenancy/getTenantCollections.js';
import {
  buildDocumentPreviewPageAssetObjectKey,
} from '../storage/storageKeys.js';
import { getStorageProvider, persistPreviewAsset } from '../storage/index.js';
import { ServiceError } from '../utils/serviceErrors.js';
import { readDocumentPreviewFile } from './documentPreviewService.js';

export type PreviewViewerType = 'pdf_pages' | 'image' | 'unsupported' | 'deep_zoom_image';

export type PreviewManifestPermissions = {
  canPreview: boolean;
  canDownload: boolean;
  canUpdate: boolean;
  canViewTracking: boolean;
};

export type PreviewManifestPage = {
  page: number;
  width: number;
  height: number;
  rotation: number;
  aspectRatio: number;
  previewUrl: string;
  thumbnailUrl: string;
};

export type PreviewManifestImageResolution = {
  label: string;
  width: number;
  url: string;
};

export type PreviewManifestImage = {
  width: number;
  height: number;
  aspectRatio: number;
  previewUrl: string;
  thumbnailUrl: string;
  resolutions: PreviewManifestImageResolution[];
};

export type DocumentPreviewManifest = {
  documentId: string;
  versionId: string;
  fileName: string;
  mimeType: string;
  viewerType: PreviewViewerType;
  pageCount: number;
  permissions: PreviewManifestPermissions;
  pages: PreviewManifestPage[];
  image: PreviewManifestImage | null;
  status: 'ready' | 'processing' | 'failed';
};

function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}

function buildManifestBasePath(documentId: string, versionId: string): string {
  return `/api/documents/${encodePathSegment(documentId)}/versions/${encodePathSegment(versionId)}/preview`;
}

function buildPagePreviewUrl(documentId: string, versionId: string, page: number): string {
  return `${buildManifestBasePath(documentId, versionId)}/pages/${page}`;
}

function buildPageThumbnailUrl(documentId: string, versionId: string, page: number): string {
  return `${buildManifestBasePath(documentId, versionId)}/thumbnails/${page}`;
}

function buildImagePreviewUrl(documentId: string, versionId: string, size?: string): string {
  const base = `${buildManifestBasePath(documentId, versionId)}/image`;
  return size ? `${base}?size=${encodeURIComponent(size)}` : base;
}

function resolveViewerTypeFromMime(mimeType: string): PreviewViewerType {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized === 'application/pdf' || normalized.endsWith('/pdf')) return 'pdf_pages';
  if (normalized.startsWith('image/')) {
    if (
      normalized === 'image/jpeg' ||
      normalized === 'image/png' ||
      normalized === 'image/webp'
    ) {
      return 'image';
    }
    if (normalized === 'image/tiff' || normalized === 'image/heic' || normalized === 'image/heif') {
      return 'unsupported';
    }
    return 'image';
  }
  return 'unsupported';
}

function mapPreviewStatus(preview: MongoPreviewStorageSlot | null | undefined): DocumentPreviewManifest['status'] {
  if (!preview) return 'failed';
  if (preview.status === 'ready') return 'ready';
  if (preview.status === 'pending' || preview.status === 'processing') return 'processing';
  return 'failed';
}

async function resolvePreviewVersion(input: {
  tenantId: string;
  ownerUserId: string;
  documentId: string;
  versionId: string;
  user: AuthUser;
  membershipId?: string;
}): Promise<{
  doc: MongoDocument;
  version: MongoDocumentVersion;
  permissions: PreviewManifestPermissions;
  storageScope?: TenantStorageScope;
}> {
  if (!isMongoNativeConfigured()) {
    throw new ServiceError('Preview não disponível.', 'PREVIEW_NOT_AVAILABLE', 404);
  }

  const { documents, documentVersions, storage } = await getTenantCollections(input.tenantId, {
    userId: input.ownerUserId,
  });

  const doc = await documents.findOne({
    _id: input.documentId,
    ...tenantScopeFilterFromContext(storage),
  } as Record<string, unknown>);

  if (!doc) {
    throw new ServiceError('Documento não encontrado.', 'DOCUMENT_NOT_FOUND', 404);
  }

  assertCanAccessDocument(doc as Record<string, unknown>, storage);

  const { memberGroupIds, governanceIndex } = await loadDocumentAccessContext({
    tenantId: input.tenantId,
    userId: input.user.id,
    membershipId: input.membershipId,
  });
  const shareGrant = await findActiveShareGrantForUser(input.documentId, input.user.id);
  const perms = resolveDocumentPermissionsWithShare(
    input.user,
    doc as MongoDocument,
    memberGroupIds,
    shareGrant,
    governanceIndex,
  );
  const permissions = {
    canPreview: perms.canPreview,
    canDownload: perms.canDownload,
    canUpdate: perms.canUpdate,
    canViewTracking: canViewDocumentTracking(input.user, {
      ownerUserId: (doc as MongoDocument).ownerUserId,
    }),
  };
  assertCanPreviewDocument({
    canPreview: permissions.canPreview,
    canDownload: permissions.canDownload,
    canEditMetadata: perms.canEditMetadata,
    canUpdate: permissions.canUpdate,
    canTrash: perms.canTrash,
    canContribute: perms.canContribute,
    canTransferOwnership: perms.canTransferOwnership,
  });

  const version = await documentVersions.findOne({
    _id: input.versionId,
    documentId: input.documentId,
    ...buildDocumentOwnershipFilter(storage),
  } as Record<string, unknown>);

  if (!version) {
    throw new ServiceError('Versão não encontrada.', 'VERSION_NOT_FOUND', 404);
  }

  return {
    doc: doc as MongoDocument,
    version: version as MongoDocumentVersion,
    permissions,
  };
}

async function ensurePdfPreviewManifest(input: {
  tenantId: string;
  ownerUserId: string;
  documentId: string;
  versionId: string;
  version: MongoDocumentVersion;
  user: AuthUser;
  membershipId?: string;
  storageScope?: TenantStorageScope;
}): Promise<MongoDocumentVersion['previewManifest']> {
  if (isPreviewManifestUsable(input.version.previewManifest, 'pdf_pages')) {
    return input.version.previewManifest;
  }

  const previewFile = await readDocumentPreviewFile({
    tenantId: input.tenantId,
    ownerUserId: input.ownerUserId,
    documentId: input.documentId,
    versionId: input.versionId,
    storageScope: input.storageScope,
    user: input.user,
    membershipId: input.membershipId,
    allowBlobWithoutDownload: true,
  });

  const previewManifest = await buildPdfPreviewManifestFromBuffer(
    previewFile.buffer,
    input.version.file?.mimeType ?? 'application/pdf',
  );

  await saveVersionPreviewManifest({
    tenantId: input.tenantId,
    ownerUserId: input.ownerUserId,
    documentId: input.documentId,
    versionId: input.versionId,
    previewManifest,
  });

  return previewManifest;
}

export async function getDocumentPreviewManifest(input: {
  tenantId: string;
  ownerUserId: string;
  documentId: string;
  versionId: string;
  user: AuthUser;
  membershipId?: string;
  storageScope?: TenantStorageScope;
}): Promise<DocumentPreviewManifest> {
  const { version, permissions } = await resolvePreviewVersion(input);
  const mimeType = version.file?.mimeType?.trim() || 'application/pdf';
  const viewerType = resolveViewerTypeFromMime(mimeType);
  const fileName = version.finalFileName ?? version.originalFileName ?? 'documento';
  const preview = version.storage?.preview;
  const status = mapPreviewStatus(preview);

  if (viewerType === 'unsupported') {
    return {
      documentId: input.documentId,
      versionId: input.versionId,
      fileName,
      mimeType,
      viewerType: 'unsupported',
      pageCount: 0,
      permissions,
      pages: [],
      image: null,
      status,
    };
  }

  if (viewerType === 'image') {
    const imageMeta = version.previewManifest?.image;
    const hasReadyPreview = preview?.status === 'ready' && Boolean(preview.objectKey);

    if (!hasReadyPreview || !imageMeta?.width || !imageMeta?.height) {
      return {
        documentId: input.documentId,
        versionId: input.versionId,
        fileName,
        mimeType,
        viewerType: 'unsupported',
        pageCount: 0,
        permissions,
        pages: [],
        image: null,
        status,
      };
    }

    const aspectRatio =
      imageMeta.aspectRatio ??
      (imageMeta.height > 0 ? Number((imageMeta.width / imageMeta.height).toFixed(4)) : 1);

    return {
      documentId: input.documentId,
      versionId: input.versionId,
      fileName,
      mimeType,
      viewerType: 'image',
      pageCount: 0,
      permissions,
      pages: [],
      image: {
        width: imageMeta.width,
        height: imageMeta.height,
        aspectRatio,
        previewUrl: buildImagePreviewUrl(input.documentId, input.versionId, 'medium'),
        thumbnailUrl: buildImagePreviewUrl(input.documentId, input.versionId, 'small'),
        resolutions: (imageMeta.resolutions ?? []).map((resolution) => ({
          label: resolution.label,
          width: resolution.width,
          url: buildImagePreviewUrl(input.documentId, input.versionId, resolution.label),
        })),
      },
      status: 'ready',
    };
  }

  if (preview?.status !== 'ready' || !preview.objectKey) {
    return {
      documentId: input.documentId,
      versionId: input.versionId,
      fileName,
      mimeType,
      viewerType: 'pdf_pages',
      pageCount: version.file?.pageCount ?? 0,
      permissions,
      pages: [],
      image: null,
      status,
    };
  }

  const persistedManifest = await ensurePdfPreviewManifest({
    tenantId: input.tenantId,
    ownerUserId: input.ownerUserId,
    documentId: input.documentId,
    versionId: input.versionId,
    version,
    user: input.user,
    membershipId: input.membershipId,
    storageScope: input.storageScope,
  });

  const pageDimensions =
    persistedManifest?.pages?.map((page) => ({
      page: page.page,
      width: page.width,
      height: page.height,
      rotation: page.rotation ?? 0,
      aspectRatio:
        page.aspectRatio ??
        (page.height > 0 ? Number((page.width / page.height).toFixed(4)) : 1),
    })) ?? [];

  const pages: PreviewManifestPage[] = pageDimensions.map((page) => ({
    ...page,
    previewUrl: buildPagePreviewUrl(input.documentId, input.versionId, page.page),
    thumbnailUrl: buildPageThumbnailUrl(input.documentId, input.versionId, page.page),
  }));

  return {
    documentId: input.documentId,
    versionId: input.versionId,
    fileName,
    mimeType,
    viewerType: 'pdf_pages',
    pageCount: pages.length,
    permissions,
    pages,
    image: null,
    status: 'ready',
  };
}

async function readCachedPageAsset(input: {
  version: MongoDocumentVersion;
  pageNumber: number;
  thumbnail: boolean;
  tenantId: string;
  storageScope?: TenantStorageScope;
}): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const pageMeta = input.version.previewManifest?.pages?.find(
    (page) => page.page === input.pageNumber,
  );
  const objectKey = input.thumbnail ? pageMeta?.thumbnailObjectKey : pageMeta?.previewObjectKey;

  if (!objectKey) return null;

  const provider = getStorageProvider();
  if (!provider) return null;

  const preview = input.version.storage?.preview;
  const file = await provider.readDocumentPreview(
    objectKey,
    input.tenantId,
    preview?.bucketAlias,
    input.storageScope,
  );

  return {
    buffer: file.buffer,
    mimeType: pageMeta?.mimeType ?? file.contentType ?? 'image/png',
  };
}

async function cacheRenderedPage(input: {
  tenantId: string;
  ownerUserId: string;
  documentId: string;
  versionId: string;
  version: MongoDocumentVersion;
  pageNumber: number;
  thumbnail: boolean;
  buffer: Buffer;
  storageScope?: TenantStorageScope;
}): Promise<void> {
  const preview = input.version.storage?.preview;
  const objectKey = buildDocumentPreviewPageAssetObjectKey({
    documentId: input.documentId,
    versionId: input.versionId,
    pageNumber: input.pageNumber,
    variant: input.thumbnail ? 'thumbnail' : 'page',
    keyPrefix: input.storageScope?.keyPrefix,
    basePrefix: input.storageScope?.basePrefix,
  });

  const stored = await persistPreviewAsset({
    tenantId: input.tenantId,
    objectKey,
    buffer: input.buffer,
    contentType: 'image/png',
    bucketAlias: preview?.bucketAlias,
    storageScope: input.storageScope,
  });

  if (!stored) return;

  await updatePreviewManifestPageCache({
    tenantId: input.tenantId,
    ownerUserId: input.ownerUserId,
    documentId: input.documentId,
    versionId: input.versionId,
    pageNumber: input.pageNumber,
    ...(input.thumbnail
      ? { thumbnailObjectKey: stored.storageKey, thumbnailSizeBytes: stored.sizeBytes }
      : { previewObjectKey: stored.storageKey, mimeType: 'image/png', sizeBytes: stored.sizeBytes }),
  });
}

export async function readDocumentPreviewPageImage(input: {
  tenantId: string;
  ownerUserId: string;
  documentId: string;
  versionId: string;
  pageNumber: number;
  user: AuthUser;
  membershipId?: string;
  storageScope?: TenantStorageScope;
  thumbnail?: boolean;
}): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
  const { version } = await resolvePreviewVersion(input);

  const cached = await readCachedPageAsset({
    version,
    pageNumber: input.pageNumber,
    thumbnail: Boolean(input.thumbnail),
    tenantId: input.tenantId,
    storageScope: input.storageScope,
  });

  if (cached) {
    return {
      buffer: cached.buffer,
      mimeType: cached.mimeType,
      fileName: input.thumbnail
        ? `preview-thumb-${input.pageNumber}.png`
        : `preview-page-${input.pageNumber}.png`,
    };
  }

  const previewFile = await readDocumentPreviewFile({
    tenantId: input.tenantId,
    ownerUserId: input.ownerUserId,
    documentId: input.documentId,
    versionId: input.versionId,
    storageScope: input.storageScope,
    user: input.user,
    membershipId: input.membershipId,
    allowBlobWithoutDownload: true,
  });

  const previewConfig = getPdfPreviewConfig();
  const rendered = await renderPdfPageToPng({
    pdfBuffer: previewFile.buffer,
    pageNumber: input.pageNumber,
    dpi: input.thumbnail ? previewConfig.thumbDpi : previewConfig.pageDpi,
  });

  await cacheRenderedPage({
    tenantId: input.tenantId,
    ownerUserId: input.ownerUserId,
    documentId: input.documentId,
    versionId: input.versionId,
    version,
    pageNumber: input.pageNumber,
    thumbnail: Boolean(input.thumbnail),
    buffer: rendered.buffer,
    storageScope: input.storageScope,
  });

  return {
    buffer: rendered.buffer,
    mimeType: rendered.mimeType,
    fileName: input.thumbnail
      ? `preview-thumb-${input.pageNumber}.png`
      : `preview-page-${input.pageNumber}.png`,
  };
}

export async function readDocumentPreviewImageAsset(input: {
  tenantId: string;
  ownerUserId: string;
  documentId: string;
  versionId: string;
  user: AuthUser;
  membershipId?: string;
  storageScope?: TenantStorageScope;
  size?: string;
}): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
  const { version } = await resolvePreviewVersion(input);
  const preview = version.storage?.preview;
  const normalizedSize = input.size?.trim().toLowerCase() || 'medium';

  if (!preview?.objectKey || preview.status !== 'ready') {
    throw new ServiceError(
      'Preview de imagem ainda não disponível.',
      'PREVIEW_NOT_READY',
      404,
    );
  }

  const resolution = version.previewManifest?.image?.resolutions?.find(
    (item) => item.label === normalizedSize,
  );
  const objectKey = resolution?.objectKey ?? preview.objectKey;
  const mimeType =
    resolution?.mimeType ?? preview.contentType ?? version.file.mimeType ?? 'image/jpeg';

  const provider = getStorageProvider();
  if (!provider) {
    throw new ServiceError('Storage não configurado.', 'STORAGE_NOT_CONFIGURED', 503);
  }

  const file = await provider.readDocumentPreview(
    objectKey,
    input.tenantId,
    preview.bucketAlias,
    input.storageScope,
  );

  const extension =
    mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';

  return {
    buffer: file.buffer,
    mimeType,
    fileName: `preview-${normalizedSize}.${extension}`,
  };
}
