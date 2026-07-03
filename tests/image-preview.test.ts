import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { join } from 'node:path';
import { describe, it, beforeEach, afterEach } from 'node:test';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { generateWatermarkedImagePreviews } from '../server/preview/imagePreviewGenerator.js';
import {
  buildPdfPreviewManifestFromBuffer,
  buildPdfPreviewManifestFromDimensions,
} from '../server/preview/previewManifestPersistence.js';
import { extractPdfPageDimensions } from '../server/preview/pdfPageDimensions.js';
import { generateDocumentPreviewForVersion } from '../server/services/documentPreviewService.js';
import { resetStorageProviderCache } from '../server/storage/index.js';
import { resolveTenantStorageScope } from '../server/tenancy/resolveTenantStorageScope.js';
import type { MongoStorageSlot } from '../server/db/types.js';

const BUSINESS_TENANT = 'company_acme_a1b2c3';
const DOCUMENT_ID = 'doc_img123';
const VERSION_ID = 'ver_img456';

function storedPrimary(objectKey: string): MongoStorageSlot {
  return {
    provider: 'local',
    status: 'stored',
    objectKey,
    bucketAlias: null,
    storedAt: new Date(),
  };
}

describe('previewManifest persistence', () => {
  it('buildPdfPreviewManifestFromBuffer persiste dimensões por página', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([595, 842]);
    doc.addPage([842, 595]);
    const manifest = await buildPdfPreviewManifestFromBuffer(Buffer.from(await doc.save()));

    assert.equal(manifest.viewerType, 'pdf_pages');
    assert.equal(manifest.source, 'preview_pdf');
    assert.equal(manifest.pageCount, 2);
    assert.equal(manifest.pages?.[0]?.width, 595);
    assert.equal(manifest.pages?.[1]?.width, 842);
    assert.equal(manifest.pages?.[0]?.status, 'pending');
  });

  it('extractPdfPageDimensions suporta páginas mistas retrato/paisagem', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([595, 842]);
    doc.addPage([842, 595]);
    doc.addPage([400, 900]);
    const pages = await extractPdfPageDimensions(Buffer.from(await doc.save()));
    assert.equal(pages.length, 3);
    assert.equal(pages[1].width, 842);
    assert.equal(pages[1].height, 595);
    assert.equal(pages[2].width, 400);
  });

  it('buildPdfPreviewManifestFromDimensions reflete pageCount > 20', () => {
    const dimensions = Array.from({ length: 25 }, (_, index) => ({
      page: index + 1,
      width: 595,
      height: 842,
      rotation: 0,
      aspectRatio: Number((595 / 842).toFixed(4)),
    }));
    const manifest = buildPdfPreviewManifestFromDimensions(dimensions);
    assert.equal(manifest.pageCount, 25);
    assert.equal(manifest.pages?.length, 25);
  });
});

describe('image preview generator', () => {
  it('gera resoluções watermarkadas para PNG', async () => {
    const original = await sharp({
      create: {
        width: 3000,
        height: 2000,
        channels: 3,
        background: { r: 40, g: 80, b: 120 },
      },
    })
      .png()
      .toBuffer();

    const result = await generateWatermarkedImagePreviews({
      originalBuffer: original,
      mimeType: 'image/png',
    });

    assert.equal(result.width, 3000);
    assert.equal(result.resolutions.length, 4);
    assert.ok(result.resolutions.some((item) => item.label === 'medium'));
    assert.ok(result.resolutions.every((item) => item.buffer.length > 0));
  });
});

describe('generateDocumentPreviewForVersion image pipeline', () => {
  let tempRoot = '';
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), 'doqyn-image-preview-'));
    process.env.STORAGE_PROVIDER = 'local';
    process.env.LOCAL_STORAGE_ROOT = tempRoot;
    process.env.PDF_PREVIEW_ENABLED = 'true';
    process.env.R2_ACCOUNT_ID = 'abc123';
    process.env.R2_ENDPOINT = 'https://abc123.r2.cloudflarestorage.com';
    process.env.R2_DEFAULT_BUCKET = 'doqyn-alpha';
    process.env.R2_BUCKET_MODE = 'per_tenant';
    process.env.R2_BUCKET_PREFIX = 'doqyn';
    process.env.R2_KEY_PREFIX = 'documents';
    resetStorageProviderCache();
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    resetStorageProviderCache();
    if (tempRoot) await rm(tempRoot, { recursive: true, force: true });
  });

  it('gera previewManifest viewerType image para PNG', async () => {
    const scope = resolveTenantStorageScope({
      tenantId: BUSINESS_TENANT,
      tenantType: 'business',
    });

    const original = await sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 3,
        background: { r: 200, g: 100, b: 50 },
      },
    })
      .png()
      .toBuffer();

    const provider = (await import('../server/storage/index.js')).getStorageProvider();
    assert.ok(provider);

    const stored = await provider!.storeDocumentVersion({
      tenantId: BUSINESS_TENANT,
      documentId: DOCUMENT_ID,
      versionId: VERSION_ID,
      buffer: original,
      mimeType: 'image/png',
      extension: 'png',
      storageFileName: 'photo.png',
      storageScope: scope,
    });

    const result = await generateDocumentPreviewForVersion({
      tenantId: BUSINESS_TENANT,
      documentId: DOCUMENT_ID,
      versionId: VERSION_ID,
      contentType: 'image/png',
      storageScope: scope,
      primary: storedPrimary(stored.storageKey),
      previewStorageFileName: 'photo_preview.pdf',
    });

    assert.equal(result.slot.status, 'ready');
    assert.equal(result.previewManifest?.viewerType, 'image');
    assert.equal(result.previewManifest?.source, 'preview_image');
    assert.ok((result.previewManifest?.image?.resolutions?.length ?? 0) >= 3);
  });
});

describe('image preview source checks', () => {
  const manifestServiceSource = readFileSync(
    join(process.cwd(), 'server/services/documentPreviewManifestService.ts'),
    'utf8',
  );

  it('readDocumentPreviewImageAsset resolve size', () => {
    assert.match(manifestServiceSource, /normalizedSize/);
    assert.match(manifestServiceSource, /resolutions\?\.find/);
  });

  it('readDocumentPreviewPageImage usa cache de storage', () => {
    assert.match(manifestServiceSource, /readCachedPageAsset/);
    assert.match(manifestServiceSource, /cacheRenderedPage/);
    assert.match(manifestServiceSource, /ensurePdfPreviewManifest/);
  });
});
