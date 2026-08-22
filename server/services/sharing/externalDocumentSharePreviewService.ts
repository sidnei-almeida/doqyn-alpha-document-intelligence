import type { MongoDocument, MongoDocumentVersion, MongoExternalDocumentShareGrant } from '../../db/types.js';
import { isMongoNativeConfigured } from '../../db/mongoClient.js';
import { renderPdfPageToPng } from '../../preview/pdfPageRenderer.js';
import { getPdfPreviewConfig } from '../../preview/previewConfig.js';
import {
  buildPdfPreviewManifestFromBuffer,
  isPreviewManifestUsable,
  saveVersionPreviewManifest,
} from '../../preview/previewManifestPersistence.js';
import type { TenantStorageScope } from '../../tenancy/resolveTenantStorageScope.js';
import {
  buildDocumentOwnershipFilter,
  tenantScopeFilterFromContext,
} from '../../tenancy/tenantQuery.js';
import { getTenantCollections } from '../../tenancy/getTenantCollections.js';
import { resolveTenantStorageScopeById } from '../../tenancy/resolveTenantStorageScope.js';
import { getStorageProvider } from '../../storage/index.js';
import { isR2StorageEnabled } from '../../storage/storageConfig.js';
import { ServiceError } from '../../utils/serviceErrors.js';
import type { DocumentPreviewManifest } from '../documentPreviewManifestService.js';
import {
  resolveExternalShareAccess,
  findExternalShareGrantByToken,
} from './externalDocumentShareService.js';

const ACTIVE_DOCUMENT_FILTER = {
  deletedAt: { $in: [null, undefined] },
  permanentlyDeletedAt: { $in: [null, undefined] },
  deactivatedAt: { $in: [null, undefined] },
};

function encodeToken(token: string): string {
  return encodeURIComponent(token);
}

function buildGuestPreviewBasePath(token: string): string {
  return `/api/external-shares/${encodeToken(token)}/preview`;
}

function buildGuestPagePreviewUrl(token: string, page: number): string {
  return `${buildGuestPreviewBasePath(token)}/pages/${page}`;
}

function buildGuestPageThumbnailUrl(token: string, page: number): string {
  return `${buildGuestPreviewBasePath(token)}/thumbnails/${page}`;
}

function buildGuestImagePreviewUrl(token: string, size?: string): string {
  const base = `${buildGuestPreviewBasePath(token)}/image`;
  return size ? `${base}?size=${encodeURIComponent(size)}` : base;
}

function resolveViewerTypeFromMime(mimeType: string): DocumentPreviewManifest['viewerType'] {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized === 'application/pdf' || normalized.endsWith('/pdf')) return 'pdf_pages';
  if (normalized.startsWith('image/')) return 'image';
  return 'unsupported';
}

async function loadGrantDocumentContext(
  grant: MongoExternalDocumentShareGrant,
): Promise<{
  doc: MongoDocument;
  version: MongoDocumentVersion;
  storageScope: TenantStorageScope;
}> {
  if (!isMongoNativeConfigured()) {
    throw new ServiceError('Documento indisponível.', 'EXTERNAL_SHARE_DOCUMENT_UNAVAILABLE', 403);
  }

  const storageScope = await resolveTenantStorageScopeById(
    grant.tenantId,
    grant.sharedByUserId,
  );
  const { documents, documentVersions, storage } = await getTenantCollections(grant.tenantId, {
    userId: grant.sharedByUserId,
  });

  const doc = await documents.findOne({
    _id: grant.documentId,
    ...tenantScopeFilterFromContext(storage),
    ...ACTIVE_DOCUMENT_FILTER,
  } as Record<string, unknown>);

  if (!doc) {
    throw new ServiceError('Documento indisponível.', 'EXTERNAL_SHARE_DOCUMENT_UNAVAILABLE', 403);
  }

  const typedDoc = doc as MongoDocument;
  const version = await documentVersions.findOne({
    _id: typedDoc.currentVersionId,
    documentId: grant.documentId,
    ...buildDocumentOwnershipFilter(storage),
  } as Record<string, unknown>);

  if (!version) {
    throw new ServiceError('Versão não encontrada.', 'VERSION_NOT_FOUND', 404);
  }

  return { doc: typedDoc, version: version as MongoDocumentVersion, storageScope };
}

async function readVersionFileBuffer(input: {
  grant: MongoExternalDocumentShareGrant;
  version: MongoDocumentVersion;
  storageScope: TenantStorageScope;
}): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
  const primaryStorage = input.version.storage?.primary;
  const storageKey = primaryStorage?.objectKey;
  if (!storageKey) {
    throw new ServiceError('Arquivo ainda não disponível.', 'FILE_NOT_STORED', 404);
  }
  if (primaryStorage?.provider === 'local' && isR2StorageEnabled()) {
    throw new ServiceError('Arquivo indisponível.', 'FILE_NOT_FOUND', 404);
  }

  const provider = getStorageProvider();
  if (!provider) {
    throw new ServiceError('Storage não configurado.', 'STORAGE_NOT_CONFIGURED', 503);
  }

  const file = await provider.readDocumentVersion(
    storageKey,
    input.grant.tenantId,
    primaryStorage?.bucketAlias,
    input.storageScope,
  );

  return {
    buffer: file.buffer,
    mimeType: input.version.file?.mimeType ?? file.contentType ?? 'application/octet-stream',
    fileName: input.version.finalFileName || input.version.originalFileName || 'documento',
  };
}

async function requireActiveExternalGrant(token: string): Promise<MongoExternalDocumentShareGrant> {
  const access = await resolveExternalShareAccess(token, { requireActive: true, touchAccess: true });
  if (!access.grant) {
    throw new ServiceError('Acesso negado.', 'EXTERNAL_SHARE_DENIED', 403);
  }
  if (!access.grant.permissions.canView) {
    throw new ServiceError('Visualização não permitida.', 'EXTERNAL_SHARE_DENIED', 403);
  }
  return access.grant;
}

export async function getExternalShareDocumentDetail(token: string) {
  const grant = await requireActiveExternalGrant(token);
  const { doc, version } = await loadGrantDocumentContext(grant);

  return {
    documentId: doc._id,
    displayName: doc.currentFileName || doc.title,
    categoryName: doc.className,
    versionId: doc.currentVersionId,
    versionLabel: doc.currentVersionLabel ?? null,
    mimeType: version.file?.mimeType ?? null,
    permissions: grant.permissions,
    expiresAt: grant.expiresAt?.toISOString() ?? null,
  };
}

export async function getExternalSharePreviewManifest(token: string): Promise<DocumentPreviewManifest> {
  const grant = await requireActiveExternalGrant(token);
  const { doc, version, storageScope } = await loadGrantDocumentContext(grant);
  const mimeType = version.file?.mimeType?.trim() || 'application/pdf';
  const viewerType = resolveViewerTypeFromMime(mimeType);
  const fileName = version.finalFileName ?? version.originalFileName ?? 'documento';
  const permissions = {
    canPreview: grant.permissions.canView,
    canDownload: grant.permissions.canDownload,
    canUpdate: false,
    canViewTracking: false,
  };

  if (viewerType === 'unsupported') {
    return {
      documentId: doc._id,
      versionId: version._id,
      fileName,
      mimeType,
      viewerType: 'unsupported',
      pageCount: 0,
      permissions,
      pages: [],
      image: null,
      status: 'failed',
    };
  }

  if (viewerType === 'image') {
    const preview = version.storage?.preview;
    const imageMeta = version.previewManifest?.image;
    if (preview?.status !== 'ready' || !preview.objectKey || !imageMeta?.width || !imageMeta?.height) {
      return {
        documentId: doc._id,
        versionId: version._id,
        fileName,
        mimeType,
        viewerType: 'unsupported',
        pageCount: 0,
        permissions,
        pages: [],
        image: null,
        status: 'failed',
      };
    }

    const aspectRatio =
      imageMeta.aspectRatio ??
      (imageMeta.height > 0 ? Number((imageMeta.width / imageMeta.height).toFixed(4)) : 1);

    return {
      documentId: doc._id,
      versionId: version._id,
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
        previewUrl: buildGuestImagePreviewUrl(token, 'medium'),
        thumbnailUrl: buildGuestImagePreviewUrl(token, 'small'),
        resolutions: (imageMeta.resolutions ?? []).map((resolution) => ({
          label: resolution.label,
          width: resolution.width,
          url: buildGuestImagePreviewUrl(token, resolution.label),
        })),
      },
      status: 'ready',
    };
  }

  let persistedManifest = version.previewManifest;
  if (!isPreviewManifestUsable(persistedManifest, 'pdf_pages')) {
    const file = await readVersionFileBuffer({ grant, version, storageScope });
    persistedManifest = await buildPdfPreviewManifestFromBuffer(file.buffer, mimeType);
    await saveVersionPreviewManifest({
      tenantId: grant.tenantId,
      ownerUserId: grant.sharedByUserId,
      documentId: grant.documentId,
      versionId: version._id,
      previewManifest: persistedManifest,
    });
  }

  const pages = (persistedManifest?.pages ?? []).map((page) => ({
    page: page.page,
    width: page.width,
    height: page.height,
    rotation: page.rotation ?? 0,
    aspectRatio: page.aspectRatio ?? (page.height > 0 ? page.width / page.height : 1),
    previewUrl: buildGuestPagePreviewUrl(token, page.page),
    thumbnailUrl: buildGuestPageThumbnailUrl(token, page.page),
  }));

  return {
    documentId: doc._id,
    versionId: version._id,
    fileName,
    mimeType,
    viewerType: 'pdf_pages',
    pageCount: pages.length,
    permissions,
    pages,
    image: null,
    status: pages.length > 0 ? 'ready' : 'processing',
  };
}

export async function readExternalSharePreviewPageImage(input: {
  token: string;
  pageNumber: number;
  thumbnail?: boolean;
}): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
  const grant = await requireActiveExternalGrant(input.token);
  const { version, storageScope } = await loadGrantDocumentContext(grant);
  const file = await readVersionFileBuffer({ grant, version, storageScope });
  const previewConfig = getPdfPreviewConfig();
  const rendered = await renderPdfPageToPng({
    pdfBuffer: file.buffer,
    pageNumber: input.pageNumber,
    dpi: input.thumbnail ? previewConfig.thumbDpi : previewConfig.pageDpi,
  });

  return {
    buffer: rendered.buffer,
    mimeType: rendered.mimeType,
    fileName: input.thumbnail
      ? `preview-thumb-${input.pageNumber}.png`
      : `preview-page-${input.pageNumber}.png`,
  };
}

export async function readExternalSharePreviewImageAsset(input: {
  token: string;
  size?: string;
}): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
  const grant = await requireActiveExternalGrant(input.token);
  const { version, storageScope } = await loadGrantDocumentContext(grant);
  const preview = version.storage?.preview;
  const normalizedSize = input.size?.trim().toLowerCase() || 'medium';

  if (!preview?.objectKey || preview.status !== 'ready') {
    throw new ServiceError('Preview indisponível.', 'PREVIEW_NOT_READY', 404);
  }

  const resolution = version.previewManifest?.image?.resolutions?.find(
    (item) => item.label === normalizedSize,
  );
  const objectKey = resolution?.objectKey ?? preview.objectKey;
  const provider = getStorageProvider();
  if (!provider) {
    throw new ServiceError('Storage não configurado.', 'STORAGE_NOT_CONFIGURED', 503);
  }

  const file = await provider.readDocumentVersion(
    objectKey,
    grant.tenantId,
    preview.bucketAlias,
    storageScope,
  );

  return {
    buffer: file.buffer,
    mimeType: file.contentType ?? version.file?.mimeType ?? 'image/jpeg',
    fileName: version.finalFileName || version.originalFileName || 'imagem',
  };
}

export async function readExternalShareDocumentDownload(token: string) {
  const grant = await requireActiveExternalGrant(token);
  if (!grant.permissions.canDownload) {
    throw new ServiceError('Download não permitido.', 'EXTERNAL_SHARE_DOWNLOAD_DENIED', 403);
  }

  const { version, storageScope } = await loadGrantDocumentContext(grant);
  const file = await readVersionFileBuffer({ grant, version, storageScope });
  return file;
}

export async function findExternalShareGrantForTracking(token: string) {
  return findExternalShareGrantByToken(token);
}
