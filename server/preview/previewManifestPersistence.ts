import type { MongoPreviewManifest, MongoPreviewManifestPage } from '../db/types.js';
import { isMongoNativeConfigured } from '../db/mongoClient.js';
import type { PdfPageDimension } from '../preview/pdfPageDimensions.js';
import { extractPdfPageDimensions } from '../preview/pdfPageDimensions.js';
import { getTenantCollections } from '../tenancy/getTenantCollections.js';
import { buildDocumentOwnershipFilter } from '../tenancy/tenantQuery.js';

export function buildPdfPreviewManifestFromDimensions(
  dimensions: PdfPageDimension[],
  mimeType = 'application/pdf',
): MongoPreviewManifest {
  return {
    viewerType: 'pdf_pages',
    mimeType,
    source: 'preview_pdf',
    status: 'ready',
    pageCount: dimensions.length,
    pages: dimensions.map(
      (dimension): MongoPreviewManifestPage => ({
        page: dimension.page,
        width: dimension.width,
        height: dimension.height,
        rotation: dimension.rotation,
        aspectRatio: dimension.aspectRatio,
        status: 'pending',
      }),
    ),
    generatedAt: new Date(),
  };
}

export async function buildPdfPreviewManifestFromBuffer(
  pdfBuffer: Buffer,
  mimeType = 'application/pdf',
): Promise<MongoPreviewManifest> {
  const dimensions = await extractPdfPageDimensions(pdfBuffer);
  return buildPdfPreviewManifestFromDimensions(dimensions, mimeType);
}

export async function saveVersionPreviewManifest(input: {
  tenantId: string;
  ownerUserId?: string;
  documentId: string;
  versionId: string;
  previewManifest: MongoPreviewManifest;
}): Promise<void> {
  if (!isMongoNativeConfigured()) return;

  const { documentVersions, storage } = await getTenantCollections(input.tenantId, {
    userId: input.ownerUserId,
  });

  await documentVersions.updateOne(
    {
      _id: input.versionId,
      documentId: input.documentId,
      ...buildDocumentOwnershipFilter(storage),
    } as Record<string, unknown>,
    { $set: { previewManifest: input.previewManifest } },
  );
}

export async function updatePreviewManifestPageCache(input: {
  tenantId: string;
  ownerUserId?: string;
  documentId: string;
  versionId: string;
  pageNumber: number;
  previewObjectKey?: string;
  thumbnailObjectKey?: string;
  mimeType?: string;
  sizeBytes?: number;
  thumbnailSizeBytes?: number;
}): Promise<void> {
  if (!isMongoNativeConfigured()) return;

  const { documentVersions, storage } = await getTenantCollections(input.tenantId, {
    userId: input.ownerUserId,
  });

  const setFields: Record<string, unknown> = {
    'previewManifest.pages.$.status': 'ready',
    'previewManifest.pages.$.generatedAt': new Date(),
  };

  if (input.previewObjectKey) {
    setFields['previewManifest.pages.$.previewObjectKey'] = input.previewObjectKey;
    setFields['previewManifest.pages.$.mimeType'] = input.mimeType ?? 'image/png';
    setFields['previewManifest.pages.$.sizeBytes'] = input.sizeBytes ?? 0;
  }

  if (input.thumbnailObjectKey) {
    setFields['previewManifest.pages.$.thumbnailObjectKey'] = input.thumbnailObjectKey;
    setFields['previewManifest.pages.$.thumbnailSizeBytes'] = input.thumbnailSizeBytes ?? 0;
  }

  await documentVersions.updateOne(
    {
      _id: input.versionId,
      documentId: input.documentId,
      'previewManifest.pages.page': input.pageNumber,
      ...buildDocumentOwnershipFilter(storage),
    } as Record<string, unknown>,
    { $set: setFields },
  );
}

export function isPreviewManifestUsable(
  manifest: MongoPreviewManifest | null | undefined,
  viewerType: MongoPreviewManifest['viewerType'],
): boolean {
  if (!manifest || manifest.viewerType !== viewerType) return false;
  if (manifest.status === 'failed') return false;
  if (viewerType === 'pdf_pages') {
    return Boolean(manifest.pages?.length);
  }
  if (viewerType === 'image') {
    return Boolean(manifest.image?.width && manifest.image?.height);
  }
  return false;
}
