import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import {
  buildIndividualBasePrefix,
  resolveTenantStorageScope,
} from '../server/tenancy/resolveTenantStorageScope.js';
import { buildDocumentPreviewObjectKey } from '../server/storage/storageKeys.js';
import { generatePdfPreview } from '../server/preview/pdfPreviewGenerator.js';
import { addDoqynWatermarkToPdf } from '../server/preview/pdfWatermark.js';
import { generateDocumentPreviewForVersion } from '../server/services/documentPreviewService.js';
import { getStorageProvider, resetStorageProviderCache } from '../server/storage/index.js';
import { ServiceError } from '../server/utils/serviceErrors.js';
import type { MongoStorageSlot } from '../server/db/types.js';
import previewHandler from '../api/documents/preview.js';

const BUSINESS_TENANT = 'company_acme_a1b2c3';
const INDIVIDUAL_TENANT = 'individual_maria_d4e5f6';
const OWNER_USER_ID = '11111111-1111-1111-1111-111111111111';
const DOCUMENT_ID = 'doc_smoke123';
const VERSION_ID = 'ver_smoke456';
const STORAGE_FILE_NAME = 'Contrato_NDA.pdf';
const PREVIEW_FILE_NAME = 'Contrato_NDA_preview.pdf';

function read(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function setR2Env(): void {
  process.env.STORAGE_PROVIDER = 'r2';
  process.env.R2_ACCOUNT_ID = 'abc123';
  process.env.R2_ENDPOINT = 'https://abc123.r2.cloudflarestorage.com';
  process.env.R2_DEFAULT_BUCKET = 'doqyn-alpha';
  process.env.R2_BUCKET_MODE = 'per_tenant';
  process.env.R2_BUCKET_PREFIX = 'doqyn';
  process.env.R2_KEY_PREFIX = 'documents';
  process.env.R2_REGION = 'auto';
}

async function createMinimalPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.addPage([400, 600]);
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

function storedPrimary(overrides: Partial<MongoStorageSlot> = {}): MongoStorageSlot {
  return {
    provider: 'cloudflare_r2',
    status: 'stored',
    objectKey: `documents/${DOCUMENT_ID}/versions/${VERSION_ID}/original/${STORAGE_FILE_NAME}`,
    bucketAlias: 'doqyn-t-abc123def456',
    storedAt: new Date(),
    ...overrides,
  };
}

describe('document preview keys', () => {
  it('build preview key business sem basePrefix', () => {
    const key = buildDocumentPreviewObjectKey({
      documentId: DOCUMENT_ID,
      versionId: VERSION_ID,
      previewStorageFileName: PREVIEW_FILE_NAME,
      keyPrefix: 'documents',
    });

    assert.equal(
      key,
      `documents/${DOCUMENT_ID}/versions/${VERSION_ID}/preview/${PREVIEW_FILE_NAME}`,
    );
    assert.ok(!key.includes('original.pdf'));
    assert.ok(!key.includes('suggested'));
    assert.ok(!key.includes('invoice'));
  });

  it('build preview key individual com basePrefix opaco', () => {
    const scope = buildIndividualBasePrefix(INDIVIDUAL_TENANT);
    const key = buildDocumentPreviewObjectKey({
      documentId: DOCUMENT_ID,
      versionId: VERSION_ID,
      previewStorageFileName: PREVIEW_FILE_NAME,
      keyPrefix: 'documents',
      basePrefix: scope,
    });

    assert.equal(
      key,
      `${scope}/documents/${DOCUMENT_ID}/versions/${VERSION_ID}/preview/${PREVIEW_FILE_NAME}`,
    );
    assert.ok(key.startsWith('individuals/'));
    assert.ok(!key.includes(OWNER_USER_ID));
  });

  it('preview key não usa originalFileName nem suggestedFileName', () => {
    const key = buildDocumentPreviewObjectKey({
      documentId: DOCUMENT_ID,
      versionId: VERSION_ID,
      previewStorageFileName: PREVIEW_FILE_NAME,
    });

    assert.equal(key.endsWith(`/preview/${PREVIEW_FILE_NAME}`), true);
    assert.ok(!key.includes('contrato-final.pdf'));
    assert.ok(!key.includes('NDA-2024.pdf'));
  });
});

describe('generatePdfPreview', () => {
  it('não chama Ghostscript real quando otimização é mockada', async () => {
    const originalPdf = await createMinimalPdf();
    const optimize = mock.fn(async (input: { inputBuffer: Buffer }) => input.inputBuffer);

    const result = await generatePdfPreview(
      { originalPdf },
      {
        addWatermark: async (input) => input.pdfBuffer,
        optimize,
      },
    );

    assert.equal(optimize.mock.callCount(), 1);
    assert.ok(result.previewSizeBytes > 0);
    assert.equal(result.watermarkText, 'DOQYN');
  });
});

describe('generateDocumentPreviewForVersion', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.PDF_PREVIEW_ENABLED = 'true';
    setR2Env();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('marca skipped para tipo não suportado', async () => {
    const scope = resolveTenantStorageScope({
      tenantId: BUSINESS_TENANT,
      tenantType: 'business',
    });

    const result = await generateDocumentPreviewForVersion({
      tenantId: BUSINESS_TENANT,
      documentId: DOCUMENT_ID,
      versionId: VERSION_ID,
      contentType: 'text/plain',
      storageScope: scope,
      primary: storedPrimary(),
      previewStorageFileName: PREVIEW_FILE_NAME,
    });

    assert.equal(result.slot.status, 'skipped');
    assert.equal(result.slot.errorCode, 'PREVIEW_UNSUPPORTED_CONTENT_TYPE');
  });
});

describe('generateDocumentPreviewForVersion with local storage', () => {
  let tempRoot = '';
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), 'doqyn-preview-'));
    setR2Env();
    process.env.STORAGE_PROVIDER = 'local';
    process.env.LOCAL_STORAGE_ROOT = tempRoot;
    process.env.MAX_UPLOAD_MB = '25';
    process.env.PDF_PREVIEW_ENABLED = 'true';
    resetStorageProviderCache();
  });

  afterEach(async () => {
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
    }
    process.env = { ...originalEnv };
    resetStorageProviderCache();
  });

  async function storeOriginalForScope(scope: ReturnType<typeof resolveTenantStorageScope>) {
    const provider = getStorageProvider();
    assert.ok(provider);
    const originalPdf = await createMinimalPdf();
    const stored = await provider.storeDocumentVersion({
      tenantId: scope.tenantId,
      documentId: DOCUMENT_ID,
      versionId: VERSION_ID,
      buffer: originalPdf,
      mimeType: 'application/pdf',
      extension: 'pdf',
      storageFileName: STORAGE_FILE_NAME,
      storageScope: scope,
    });

    const primary: MongoStorageSlot = {
      provider: 'local',
      status: 'stored',
      objectKey: stored.storageKey,
      bucketAlias: stored.bucket ?? null,
      storedAt: new Date(),
    };

    return { primary, scope };
  }

  it('storage.preview.status=ready quando geração mockada OK', async () => {
    const scope = resolveTenantStorageScope({
      tenantId: INDIVIDUAL_TENANT,
      tenantType: 'individual',
      ownerUserId: OWNER_USER_ID,
    });
    const { primary } = await storeOriginalForScope(scope);

    const result = await generateDocumentPreviewForVersion({
      tenantId: INDIVIDUAL_TENANT,
      documentId: DOCUMENT_ID,
      versionId: VERSION_ID,
      contentType: 'application/pdf',
      storageScope: scope,
      primary,
      previewStorageFileName: PREVIEW_FILE_NAME,
      previewDeps: {
        addWatermark: async (input) => input.pdfBuffer,
        optimize: async (input) => input.inputBuffer,
      },
    });

    assert.equal(result.slot.status, 'ready');
    assert.equal(result.slot.contentType, 'application/pdf');
    assert.equal(
      result.slot.objectKey,
      `${scope.basePrefix}/documents/${DOCUMENT_ID}/versions/${VERSION_ID}/preview/${PREVIEW_FILE_NAME}`,
    );
    assert.equal(result.slot.watermark?.type, 'logo');
    assert.equal(result.slot.watermark?.value, 'doqyn-horizontal');
    assert.equal(result.slot.optimization?.engine, 'ghostscript');
    assert.ok(result.previewManifest);
    assert.equal(result.previewManifest?.viewerType, 'pdf_pages');
    assert.equal(result.previewManifest?.pageCount, 1);
    assert.equal(result.previewManifest?.pages?.length, 1);
  });

  it('storage.preview.status=failed quando geração mockada falha', async () => {
    const scope = resolveTenantStorageScope({
      tenantId: BUSINESS_TENANT,
      tenantType: 'business',
    });
    const { primary } = await storeOriginalForScope(scope);

    const result = await generateDocumentPreviewForVersion({
      tenantId: BUSINESS_TENANT,
      documentId: DOCUMENT_ID,
      versionId: VERSION_ID,
      contentType: 'application/pdf',
      storageScope: scope,
      primary,
      previewStorageFileName: PREVIEW_FILE_NAME,
      previewDeps: {
        addWatermark: async () => {
          throw new ServiceError('Falha watermark', 'WATERMARK_FAILED', 500);
        },
      },
    });

    assert.equal(result.slot.status, 'failed');
    assert.equal(result.slot.errorCode, 'WATERMARK_FAILED');
  });

  it('falha Ghostscript não lança exceção', async () => {
    const scope = resolveTenantStorageScope({
      tenantId: BUSINESS_TENANT,
      tenantType: 'business',
    });
    const { primary } = await storeOriginalForScope(scope);

    const result = await generateDocumentPreviewForVersion({
      tenantId: BUSINESS_TENANT,
      documentId: DOCUMENT_ID,
      versionId: VERSION_ID,
      contentType: 'application/pdf',
      storageScope: scope,
      primary,
      previewStorageFileName: PREVIEW_FILE_NAME,
      previewDeps: {
        addWatermark: async (input) => input.pdfBuffer,
        optimize: async () => {
          throw new ServiceError(
            'Ghostscript não está disponível no servidor.',
            'GHOSTSCRIPT_NOT_AVAILABLE',
            503,
          );
        },
      },
    });

    assert.equal(result.slot.status, 'failed');
    assert.equal(result.slot.errorCode, 'GHOSTSCRIPT_NOT_AVAILABLE');
  });
});

describe('addDoqynWatermarkToPdf', () => {
  it('retorna PDF diferente do original', async () => {
    const originalPdf = await createMinimalPdf();
    const watermarked = await addDoqynWatermarkToPdf({ pdfBuffer: originalPdf });
    assert.notEqual(watermarked.equals(originalPdf), true);
    assert.ok(watermarked.length > 0);
  });
});

describe('doqyn logo watermark asset', () => {
  it('rasteriza logo horizontal com canal alpha', async () => {
    const { rasterizeDoqynWatermarkLogo, DOQYN_HORIZONTAL_LOGO_ASPECT } = await import(
      '../server/preview/watermarkAsset.js'
    );
    const logo = await rasterizeDoqynWatermarkLogo(480);
    assert.ok(logo.length > 0);
    const meta = await sharp(logo).metadata();
    assert.equal(meta.format, 'png');
    assert.ok((meta.width ?? 0) > (meta.height ?? 0));
    assert.ok(Math.abs((meta.width ?? 1) / (meta.height ?? 1) - DOQYN_HORIZONTAL_LOGO_ASPECT) < 0.05);
    assert.equal(meta.hasAlpha, true);

    const { data } = await sharp(logo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let grayPixels = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index + 3] < 32) continue;
      assert.equal(data[index], 128);
      assert.equal(data[index + 1], 128);
      assert.equal(data[index + 2], 128);
      grayPixels += 1;
    }
    assert.ok(grayPixels > 100);
  });

  it('gera overlay diagonal com a marca DOQYN', async () => {
    const { buildDoqynLogoWatermarkOverlay } = await import('../server/preview/watermarkTiling.js');
    const overlay = await buildDoqynLogoWatermarkOverlay(1200, 800);
    const stats = await sharp(overlay).stats();
    assert.ok(stats.channels.some((channel) => channel.max > 0));
  });
});

describe('document preview quality', () => {
  it('usa DPI e qualidade de imagem configuráveis para páginas do viewer', () => {
    const config = read('server/preview/previewConfig.ts');
    const renderer = read('server/preview/pdfPageRenderer.ts');
    const images = read('server/preview/imagePreviewGenerator.ts');
    const watermarkAsset = read('server/preview/watermarkAsset.ts');
    const viewer = read('src/features/documents/viewer/PdfPagesViewer.tsx');

    assert.ok(config.includes('DEFAULT_PAGE_DPI'));
    assert.ok(config.includes('PDF_PREVIEW_PAGE_DPI'));
    assert.ok(config.includes('imagePreviewQuality'));
    assert.ok(renderer.includes('dTextAlphaBits=4'));
    assert.ok(renderer.includes('config.pageDpi'));
    assert.ok(images.includes('maxWidth: 1680'));
    assert.ok(images.includes('buildDoqynLogoWatermarkOverlay'));
    assert.ok(watermarkAsset.includes('doqyn-horizontal.webp'));
    assert.ok(watermarkAsset.includes('DOQYN_HORIZONTAL_LOGO_ASPECT'));
    assert.ok(watermarkAsset.includes('DOQYN_WATERMARK_GRAY'));
    assert.ok(images.includes('mozjpeg: true'));
    assert.ok(viewer.includes('viewer-page-image'));
    assert.ok(viewer.includes('decoding="async"'));
  });
});

describe('GET /api/documents/preview', () => {
  it('exige autenticação', async () => {
    const status = mock.fn();
    const json = mock.fn();
    const res = {
      status(code: number) {
        status(code);
        return { json };
      },
      setHeader: () => undefined,
      send: () => undefined,
    };

    await previewHandler(
      { method: 'GET', query: { documentId: DOCUMENT_ID }, headers: {} } as never,
      res as never,
    );

    assert.equal(status.mock.callCount(), 1);
    assert.equal(status.mock.calls[0].arguments[0], 401);
  });

  it('não retorna URL R2 no corpo JSON de erro', async () => {
    const body: Array<Record<string, unknown>> = [];
    const res = {
      status() {
        return {
          json(payload: Record<string, unknown>) {
            body.push(payload);
          },
        };
      },
      setHeader: () => undefined,
      send: () => undefined,
    };

    await previewHandler(
      { method: 'GET', query: { documentId: DOCUMENT_ID }, headers: {} } as never,
      res as never,
    );

    const payload = JSON.stringify(body[0] ?? {});
    assert.ok(!payload.includes('r2.cloudflarestorage.com'));
    assert.ok(!payload.includes('presigned'));
    assert.ok(!payload.includes('X-Amz-Signature'));
  });
});
