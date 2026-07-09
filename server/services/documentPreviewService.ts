import type {
  MongoPreviewManifest,
  MongoPreviewStorageSlot,
  MongoStorageSlot,
} from '../db/types.js';
import type { TenantStorageScope } from '../tenancy/resolveTenantStorageScope.js';
import type { AuthUser } from '../auth/types.js';
import { generatePdfPreview, type PdfPreviewGeneratorDeps } from '../preview/pdfPreviewGenerator.js';
import { generateWatermarkedImagePreviews } from '../preview/imagePreviewGenerator.js';
import {
  buildPdfPreviewManifestFromBuffer,
  saveVersionPreviewManifest,
} from '../preview/previewManifestPersistence.js';
import { getPdfPreviewConfig } from '../preview/previewConfig.js';
import {
  buildDocumentPreviewImageResolutionObjectKey,
  buildDocumentPreviewObjectKey,
} from '../storage/storageKeys.js';
import {
  getStorageProvider,
  isStorageConfigured,
  persistDocumentPreviewFile,
  persistPreviewAsset,
} from '../storage/index.js';
import { isServiceError } from '../utils/serviceErrors.js';
import { logger } from '../utils/logger.js';
import { isMongoNativeConfigured } from '../db/mongoClient.js';
import type { MongoDocument, MongoDocumentVersion } from '../db/types.js';
import { getTenantCollections } from '../tenancy/getTenantCollections.js';
import {
  assertCanAccessDocument,
  buildDocumentOwnershipFilter,
  tenantScopeFilterFromContext,
} from '../tenancy/tenantQuery.js';
import { ServiceError } from '../utils/serviceErrors.js';
import {
  assertCanPreviewDocument,
  loadMemberDocumentGroupIds,
} from '../tenancy/documentAccess.js';
import { resolveDocumentPermissionsWithShare } from '../tenancy/documentShareAccess.js';
import { findActiveShareGrantForUser } from './sharing/documentShareService.js';

export { buildDocumentPreviewObjectKey } from '../storage/storageKeys.js';

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function resolvePreviewProvider(
  primary: MongoStorageSlot,
): MongoPreviewStorageSlot['provider'] {
  if (primary.provider === 'cloudflare_r2') return 'cloudflare_r2';
  if (primary.provider === 'local') return 'local';
  return 'aws_s3';
}

function buildSkippedPreview(errorCode: string, errorMessage: string): MongoPreviewStorageSlot {
  return {
    provider: 'cloudflare_r2',
    status: 'skipped',
    bucketAlias: null,
    objectKey: null,
    errorCode,
    errorMessage,
  };
}

function buildFailedPreview(
  errorCode: string,
  errorMessage: string,
  partial?: Partial<MongoPreviewStorageSlot>,
): MongoPreviewStorageSlot {
  return {
    provider: partial?.provider ?? 'cloudflare_r2',
    status: 'failed',
    bucketAlias: partial?.bucketAlias ?? null,
    objectKey: partial?.objectKey ?? null,
    sourceVersionId: partial?.sourceVersionId ?? null,
    errorCode,
    errorMessage,
  };
}

export type GenerateDocumentPreviewInput = {
  tenantId: string;
  documentId: string;
  versionId: string;
  contentType: string;
  storageScope: TenantStorageScope;
  primary: MongoStorageSlot;
  previewStorageFileName: string;
  previewDeps?: PdfPreviewGeneratorDeps;
};

export type GenerateDocumentPreviewResult = {
  slot: MongoPreviewStorageSlot;
  previewManifest?: MongoPreviewManifest | null;
};

async function generateImagePreviewManifest(input: {
  tenantId: string;
  documentId: string;
  versionId: string;
  contentType: string;
  storageScope: TenantStorageScope;
  primary: MongoStorageSlot;
  originalBuffer: Buffer;
}): Promise<{ slot: MongoPreviewStorageSlot; previewManifest: MongoPreviewManifest }> {
  const previewProvider = resolvePreviewProvider(input.primary);
  const previewResult = await generateWatermarkedImagePreviews({
    originalBuffer: input.originalBuffer,
    mimeType: input.contentType,
  });

  const storedResolutions: MongoPreviewManifest['image'] = {
    width: previewResult.width,
    height: previewResult.height,
    aspectRatio: previewResult.aspectRatio,
    resolutions: [],
  };

  let mediumObjectKey: string | null = null;
  let mediumMimeType = input.contentType;
  let mediumSizeBytes = 0;

  for (const resolution of previewResult.resolutions) {
    const objectKey = buildDocumentPreviewImageResolutionObjectKey({
      documentId: input.documentId,
      versionId: input.versionId,
      label: resolution.label,
      extension: resolution.extension,
      keyPrefix: input.storageScope.keyPrefix,
      basePrefix: input.storageScope.basePrefix,
    });

    const stored = await persistPreviewAsset({
      tenantId: input.tenantId,
      objectKey,
      buffer: resolution.buffer,
      contentType: resolution.mimeType,
      bucketAlias: input.primary.bucketAlias,
      storageScope: input.storageScope,
    });

    if (!stored) {
      throw new ServiceError('Storage não configurado.', 'STORAGE_NOT_CONFIGURED', 503);
    }

    storedResolutions.resolutions?.push({
      label: resolution.label,
      width: resolution.width,
      height: resolution.height,
      objectKey: stored.storageKey,
      mimeType: resolution.mimeType,
      sizeBytes: stored.sizeBytes,
    });

    if (resolution.label === 'medium') {
      mediumObjectKey = stored.storageKey;
      mediumMimeType = resolution.mimeType;
      mediumSizeBytes = stored.sizeBytes;
    }
  }

  const now = new Date();
  const previewManifest: MongoPreviewManifest = {
    viewerType: 'image',
    mimeType: input.contentType,
    source: 'preview_image',
    status: 'ready',
    pageCount: 0,
    pages: [],
    image: storedResolutions,
    generatedAt: now,
  };

  return {
    slot: {
      provider: previewProvider,
      status: 'ready',
      bucketAlias: input.primary.bucketAlias,
      objectKey: mediumObjectKey,
      contentType: mediumMimeType,
      sizeBytes: mediumSizeBytes,
      generatedAt: now,
      sourceVersionId: input.versionId,
      watermark: {
        type: 'text',
        value: getPdfPreviewConfig().watermarkText,
      },
    },
    previewManifest,
  };
}

/** Gera preview best-effort — nunca lança exceção para não quebrar confirm-analysis. */
export async function generateDocumentPreviewForVersion(
  input: GenerateDocumentPreviewInput,
): Promise<GenerateDocumentPreviewResult> {
  const config = getPdfPreviewConfig();
  const previewProvider = resolvePreviewProvider(input.primary);
  const normalizedContentType = input.contentType.trim().toLowerCase();
  const isPdf = normalizedContentType === 'application/pdf';
  const isImage = IMAGE_MIME_TYPES.has(normalizedContentType);

  if (!config.enabled) {
    return { slot: buildSkippedPreview('PREVIEW_DISABLED', 'Preview desabilitado.') };
  }

  if (!isPdf && !isImage) {
    return {
      slot: buildSkippedPreview(
        'PREVIEW_UNSUPPORTED_CONTENT_TYPE',
        'Preview disponível apenas para PDF e imagens JPG/PNG/WebP.',
      ),
    };
  }

  if (!isStorageConfigured()) {
    return { slot: buildSkippedPreview('STORAGE_NOT_CONFIGURED', 'Storage não configurado.') };
  }

  if (input.primary.status !== 'stored' || !input.primary.objectKey?.trim()) {
    return { slot: buildSkippedPreview('ORIGINAL_NOT_STORED', 'Original ainda não armazenado.') };
  }

  const provider = getStorageProvider();
  if (!provider) {
    return { slot: buildFailedPreview('STORAGE_NOT_CONFIGURED', 'Storage não configurado.') };
  }

  const previewObjectKey = buildDocumentPreviewObjectKey({
    documentId: input.documentId,
    versionId: input.versionId,
    previewStorageFileName: input.previewStorageFileName,
    keyPrefix: input.storageScope.keyPrefix,
    basePrefix: input.storageScope.basePrefix,
  });

  try {
    const original = await provider.readDocumentVersion(
      input.primary.objectKey,
      input.tenantId,
      input.primary.bucketAlias,
      input.storageScope,
    );

    if (isImage) {
      const imageResult = await generateImagePreviewManifest({
        tenantId: input.tenantId,
        documentId: input.documentId,
        versionId: input.versionId,
        contentType: normalizedContentType,
        storageScope: input.storageScope,
        primary: input.primary,
        originalBuffer: original.buffer,
      });

      return imageResult;
    }

    const previewResult = await generatePdfPreview(
      { originalPdf: original.buffer },
      input.previewDeps ?? {},
    );

    const stored = await persistDocumentPreviewFile({
      tenantId: input.tenantId,
      documentId: input.documentId,
      versionId: input.versionId,
      buffer: previewResult.buffer,
      previewStorageFileName: input.previewStorageFileName,
      storageScope: input.storageScope,
    });

    if (!stored) {
      return {
        slot: buildFailedPreview('STORAGE_NOT_CONFIGURED', 'Storage não configurado.', {
          provider: previewProvider,
          objectKey: previewObjectKey,
          bucketAlias: input.primary.bucketAlias,
          sourceVersionId: input.versionId,
        }),
      };
    }

    const previewManifest = await buildPdfPreviewManifestFromBuffer(
      previewResult.buffer,
      normalizedContentType,
    );

    const now = new Date();

    return {
      slot: {
        provider: previewProvider,
        status: 'ready',
        bucketAlias: stored.bucket ?? input.primary.bucketAlias,
        objectKey: stored.storageKey,
        contentType: 'application/pdf',
        sizeBytes: stored.sizeBytes,
        generatedAt: now,
        sourceVersionId: input.versionId,
        watermark: {
          type: 'text',
          value: previewResult.watermarkText,
        },
        optimization: {
          engine: 'ghostscript',
          profile: previewResult.profile,
          originalSizeBytes: previewResult.originalSizeBytes,
          previewSizeBytes: previewResult.previewSizeBytes,
          compressionRatio: previewResult.compressionRatio,
        },
      },
      previewManifest,
    };
  } catch (error) {
    const errorCode = isServiceError(error) ? error.code : 'PREVIEW_GENERATION_FAILED';
    const errorMessage = isServiceError(error)
      ? error.message
      : 'Falha ao gerar preview do documento.';

    if (errorCode === 'GHOSTSCRIPT_NOT_AVAILABLE') {
      logger.warn('Ghostscript indisponível — preview não gerado.', {
        documentId: input.documentId,
        versionId: input.versionId,
      });
    } else {
      logger.warn('document preview generation failed', {
        documentId: input.documentId,
        versionId: input.versionId,
        code: errorCode,
      });
    }

    return {
      slot: buildFailedPreview(errorCode, errorMessage, {
        provider: previewProvider,
        objectKey: previewObjectKey,
        bucketAlias: input.primary.bucketAlias,
        sourceVersionId: input.versionId,
      }),
    };
  }
}

export async function persistGeneratedPreviewManifest(input: {
  tenantId: string;
  ownerUserId?: string;
  documentId: string;
  versionId: string;
  previewManifest?: MongoPreviewManifest | null;
}): Promise<void> {
  if (!input.previewManifest) return;
  await saveVersionPreviewManifest({
    tenantId: input.tenantId,
    ownerUserId: input.ownerUserId,
    documentId: input.documentId,
    versionId: input.versionId,
    previewManifest: input.previewManifest,
  });
}

export async function readDocumentPreviewFile(input: {
  tenantId: string;
  ownerUserId: string;
  documentId: string;
  versionId?: string;
  storageScope?: TenantStorageScope;
  user: AuthUser;
  membershipId?: string;
  /** Quando false (padrão), bloqueia blob PDF para usuários sem canDownload. */
  allowBlobWithoutDownload?: boolean;
}): Promise<{
  buffer: Buffer;
  mimeType: string;
  storageKey: string;
  previewStatus: MongoPreviewStorageSlot['status'];
  fileName: string;
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

  const memberGroupIds = await loadMemberDocumentGroupIds({
    tenantId: input.tenantId,
    userId: input.user.id,
    membershipId: input.membershipId,
  });
  const shareGrant = await findActiveShareGrantForUser(input.documentId, input.user.id);
  const permissions = resolveDocumentPermissionsWithShare(
    input.user,
    doc as MongoDocument,
    memberGroupIds,
    shareGrant,
  );
  assertCanPreviewDocument(permissions);

  if (!input.allowBlobWithoutDownload && !permissions.canDownload) {
    throw new ServiceError(
      'Use o manifest de preview para visualização protegida.',
      'PREVIEW_BLOB_RESTRICTED',
      403,
    );
  }

  const resolvedVersionId = input.versionId ?? (doc as MongoDocument).currentVersionId;
  const version = await documentVersions.findOne({
    _id: resolvedVersionId,
    documentId: input.documentId,
    ...buildDocumentOwnershipFilter(storage),
  } as Record<string, unknown>);

  if (!version) {
    throw new ServiceError('Versão não encontrada.', 'VERSION_NOT_FOUND', 404);
  }

  const versionDoc = version as MongoDocumentVersion;
  const preview = versionDoc.storage?.preview;

  if (!preview) {
    throw new ServiceError(
      'Preview ainda não disponível para este documento.',
      'PREVIEW_NOT_READY',
      404,
    );
  }

  if (preview.status === 'pending' || preview.status === 'processing') {
    throw new ServiceError('Preview em processamento.', 'PREVIEW_NOT_READY', 202);
  }

  if (preview.status === 'failed') {
    throw new ServiceError(
      'Não foi possível gerar o preview deste documento.',
      'PREVIEW_FAILED',
      409,
    );
  }

  if (preview.status === 'skipped') {
    throw new ServiceError(
      'Preview ainda não disponível para este documento.',
      'PREVIEW_NOT_READY',
      409,
    );
  }

  if (preview.status !== 'ready' || !preview.objectKey) {
    throw new ServiceError(
      'Preview ainda não disponível para este documento.',
      'PREVIEW_NOT_READY',
      404,
    );
  }

  const provider = getStorageProvider();
  if (!provider) {
    throw new ServiceError('Storage não configurado.', 'STORAGE_NOT_CONFIGURED', 503);
  }

  const file = await provider.readDocumentPreview(
    preview.objectKey,
    input.tenantId,
    preview.bucketAlias,
    input.storageScope,
  );

  return {
    buffer: file.buffer,
    mimeType: preview.contentType ?? file.contentType ?? 'application/pdf',
    storageKey: preview.objectKey,
    previewStatus: preview.status,
    fileName:
      versionDoc.previewStorageFileName ??
      versionDoc.finalFileName?.replace(/\.pdf$/i, '_preview.pdf') ??
      'preview.pdf',
  };
}
