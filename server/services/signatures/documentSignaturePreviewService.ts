import { renderPdfPageToPng } from '../../preview/pdfPageRenderer.js';
import { getPdfPreviewConfig } from '../../preview/previewConfig.js';
import {
  buildPdfPreviewManifestFromBuffer,
  isPreviewManifestUsable,
  saveVersionPreviewManifest,
} from '../../preview/previewManifestPersistence.js';
import { ServiceError } from '../../utils/serviceErrors.js';
import type { DocumentPreviewManifest } from '../documentPreviewManifestService.js';
import { getStorageProvider } from '../../storage/index.js';
import {
  loadSignatureRequestDocumentContext,
  readSignatureRequestVersionFile,
  requireAssignedInternalSignatureRequest,
  requireSignaturePortalRequest,
} from './documentSignatureService.js';
import type { AuthUser } from '../../auth/types.js';
import type { DocumentRequestContext } from '../../tenancy/documentRequestContext.js';

function encodeToken(token: string): string {
  return encodeURIComponent(token);
}

function buildSignaturePreviewBasePath(token: string): string {
  return `/api/sign/${encodeToken(token)}/preview`;
}

function buildSignaturePagePreviewUrl(token: string, page: number): string {
  return `${buildSignaturePreviewBasePath(token)}/pages/${page}`;
}

function buildSignaturePageThumbnailUrl(token: string, page: number): string {
  return `${buildSignaturePreviewBasePath(token)}/thumbnails/${page}`;
}

function resolveViewerTypeFromMime(mimeType: string): DocumentPreviewManifest['viewerType'] {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized === 'application/pdf' || normalized.endsWith('/pdf')) return 'pdf_pages';
  if (normalized.startsWith('image/')) return 'image';
  return 'unsupported';
}

export async function getSignaturePreviewManifest(token: string): Promise<DocumentPreviewManifest> {
  const request = await requireSignaturePortalRequest(token, {
    requireOpen: true,
    requireCanView: true,
  });
  const { doc, version, storageScope } = await loadSignatureRequestDocumentContext(request);
  const mimeType = version.file?.mimeType?.trim() || 'application/pdf';
  const viewerType = resolveViewerTypeFromMime(mimeType);
  const fileName = version.finalFileName ?? version.originalFileName ?? doc.currentFileName ?? 'documento';
  const permissions = {
    canPreview: request.permissions.canView,
    canDownload: false,
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
        previewUrl: `${buildSignaturePreviewBasePath(token)}/image?size=medium`,
        thumbnailUrl: `${buildSignaturePreviewBasePath(token)}/image?size=small`,
        resolutions: (imageMeta.resolutions ?? []).map((resolution) => ({
          label: resolution.label,
          width: resolution.width,
          url: `${buildSignaturePreviewBasePath(token)}/image?size=${encodeURIComponent(resolution.label)}`,
        })),
      },
      status: 'ready',
    };
  }

  let persistedManifest = version.previewManifest;
  if (!isPreviewManifestUsable(persistedManifest, 'pdf_pages')) {
    const file = await readSignatureRequestVersionFile({ request, version, storageScope });
    persistedManifest = await buildPdfPreviewManifestFromBuffer(file.buffer, mimeType);
    await saveVersionPreviewManifest({
      tenantId: request.tenantId,
      ownerUserId: request.requestedByUserId,
      documentId: request.documentId,
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
    previewUrl: buildSignaturePagePreviewUrl(token, page.page),
    thumbnailUrl: buildSignaturePageThumbnailUrl(token, page.page),
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

export async function readSignaturePreviewPageImage(input: {
  token: string;
  pageNumber: number;
  thumbnail?: boolean;
}): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
  const request = await requireSignaturePortalRequest(input.token, {
    requireOpen: true,
    requireCanView: true,
  });
  const { version, storageScope } = await loadSignatureRequestDocumentContext(request);
  const file = await readSignatureRequestVersionFile({ request, version, storageScope });
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

export async function readSignaturePreviewImageAsset(input: {
  token: string;
  size?: string;
}): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
  const request = await requireSignaturePortalRequest(input.token, {
    requireOpen: true,
    requireCanView: true,
  });
  const { version, storageScope } = await loadSignatureRequestDocumentContext(request);
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
    request.tenantId,
    preview.bucketAlias,
    storageScope,
  );

  return {
    buffer: file.buffer,
    mimeType: file.contentType ?? version.file?.mimeType ?? 'image/jpeg',
    fileName: version.finalFileName || version.originalFileName || 'imagem',
  };
}

export function assertSignatureManifestVersion(
  manifest: DocumentPreviewManifest,
  requestVersionId: string,
): void {
  if (manifest.versionId !== requestVersionId) {
    throw new ServiceError('Versão de preview incompatível.', 'SIGNATURE_VERSION_MISMATCH', 409);
  }
}

function buildInternalSignaturePreviewBasePath(signatureRequestId: string): string {
  return `/api/signature-requests/${encodeURIComponent(signatureRequestId)}/preview`;
}

async function buildSignaturePreviewManifestForRequest(
  request: Awaited<ReturnType<typeof requireSignaturePortalRequest>>,
  buildPagePreviewUrl: (page: number) => string,
  buildPageThumbnailUrl: (page: number) => string,
  buildImagePreviewUrl: (size: string) => string,
): Promise<DocumentPreviewManifest> {
  const { doc, version, storageScope } = await loadSignatureRequestDocumentContext(request);
  const mimeType = version.file?.mimeType?.trim() || 'application/pdf';
  const viewerType = resolveViewerTypeFromMime(mimeType);
  const fileName = version.finalFileName ?? version.originalFileName ?? doc.currentFileName ?? 'documento';
  const permissions = {
    canPreview: request.permissions.canView,
    canDownload: false,
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
        previewUrl: buildImagePreviewUrl('medium'),
        thumbnailUrl: buildImagePreviewUrl('small'),
        resolutions: (imageMeta.resolutions ?? []).map((resolution) => ({
          label: resolution.label,
          width: resolution.width,
          url: buildImagePreviewUrl(resolution.label),
        })),
      },
      status: 'ready',
    };
  }

  let persistedManifest = version.previewManifest;
  if (!isPreviewManifestUsable(persistedManifest, 'pdf_pages')) {
    const file = await readSignatureRequestVersionFile({ request, version, storageScope });
    persistedManifest = await buildPdfPreviewManifestFromBuffer(file.buffer, mimeType);
    await saveVersionPreviewManifest({
      tenantId: request.tenantId,
      ownerUserId: request.requestedByUserId,
      documentId: request.documentId,
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
    previewUrl: buildPagePreviewUrl(page.page),
    thumbnailUrl: buildPageThumbnailUrl(page.page),
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

export async function getInternalSignaturePreviewManifest(
  ctx: DocumentRequestContext,
  user: AuthUser,
  signatureRequestId: string,
): Promise<DocumentPreviewManifest> {
  const request = await requireAssignedInternalSignatureRequest(ctx, user, signatureRequestId, {
    requireOpen: true,
    requireCanView: true,
  });
  const base = buildInternalSignaturePreviewBasePath(signatureRequestId);
  return buildSignaturePreviewManifestForRequest(
    request,
    (page) => `${base}/pages/${page}`,
    (page) => `${base}/thumbnails/${page}`,
    (size) => `${base}/image?size=${encodeURIComponent(size)}`,
  );
}

export async function readInternalSignaturePreviewPageImage(input: {
  ctx: DocumentRequestContext;
  user: AuthUser;
  signatureRequestId: string;
  pageNumber: number;
  thumbnail?: boolean;
}): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
  const request = await requireAssignedInternalSignatureRequest(
    input.ctx,
    input.user,
    input.signatureRequestId,
    { requireOpen: true, requireCanView: true },
  );
  const { version, storageScope } = await loadSignatureRequestDocumentContext(request);
  const file = await readSignatureRequestVersionFile({ request, version, storageScope });
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

export async function readInternalSignaturePreviewImageAsset(input: {
  ctx: DocumentRequestContext;
  user: AuthUser;
  signatureRequestId: string;
  size?: string;
}): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
  const request = await requireAssignedInternalSignatureRequest(
    input.ctx,
    input.user,
    input.signatureRequestId,
    { requireOpen: true, requireCanView: true },
  );
  const { version, storageScope } = await loadSignatureRequestDocumentContext(request);
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
    request.tenantId,
    preview.bucketAlias,
    storageScope,
  );

  return {
    buffer: file.buffer,
    mimeType: file.contentType ?? version.file?.mimeType ?? 'image/jpeg',
    fileName: version.finalFileName || version.originalFileName || 'imagem',
  };
}
