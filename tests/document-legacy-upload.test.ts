import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { resetStorageProviderCache } from '../server/storage/index.js';
import { storeUploadedDocumentFile } from '../server/services/documentFileService.js';
import { resolveStorageFileNames } from '../server/utils/resolveStorageFileNames.js';

const TENANT = 'company_dev';
const DOCUMENT_ID = 'legacy_doc_001';
const VERSION_ID = 'legacy_ver_001';

describe('upload legado — naming e storage', () => {
  let tempRoot = '';

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), 'doqyn-legacy-'));
    process.env.STORAGE_PROVIDER = 'local';
    process.env.LOCAL_STORAGE_ROOT = tempRoot;
    resetStorageProviderCache();
  });

  afterEach(async () => {
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
    delete process.env.STORAGE_PROVIDER;
    delete process.env.LOCAL_STORAGE_ROOT;
    resetStorageProviderCache();
  });

  it('salva storageFileName e previewStorageFileName para nome válido', async () => {
    const resolved = resolveStorageFileNames({
      originalFileName: 'Meu_Contrato.pdf',
      aiSuggestedFileName: 'Meu_Contrato.pdf',
      namingMode: 'original',
      documentId: DOCUMENT_ID,
      versionLabel: 'v1',
    });

    const storage = await storeUploadedDocumentFile({
      tenantId: TENANT,
      documentId: DOCUMENT_ID,
      versionId: VERSION_ID,
      buffer: Buffer.from('%PDF-1.4 legacy'),
      mimeType: 'application/pdf',
      originalFileName: 'Meu_Contrato.pdf',
      storageFileName: resolved.storageFileName,
    });

    assert.equal(resolved.finalFileName, 'Meu_Contrato.pdf');
    assert.equal(resolved.storageFileName, 'Meu_Contrato.pdf');
    assert.equal(resolved.namingMode, 'original');
    assert.equal(resolved.previewStorageFileName, 'Meu_Contrato_preview.pdf');
    assert.match(storage.primary.objectKey!, /\/original\/Meu_Contrato\.pdf$/);
    assert.equal(resolved.finalFileName, resolved.storageFileName);
  });

  it('original.pdf no upload legado usa fallback no storageFileName', async () => {
    const resolved = resolveStorageFileNames({
      originalFileName: 'original.pdf',
      aiSuggestedFileName: 'original.pdf',
      namingMode: 'original',
      documentId: DOCUMENT_ID,
      versionLabel: 'v1',
    });

    const storage = await storeUploadedDocumentFile({
      tenantId: TENANT,
      documentId: DOCUMENT_ID,
      versionId: VERSION_ID,
      buffer: Buffer.from('%PDF-1.4'),
      mimeType: 'application/pdf',
      originalFileName: 'original.pdf',
      storageFileName: resolved.storageFileName,
    });

    assert.ok(resolved.storageFileName.startsWith('Documento_'));
    assert.equal(resolved.finalFileName, resolved.storageFileName);
    assert.ok(!storage.primary.objectKey!.endsWith('/original.pdf'));
  });

  it('preview legado não gerado usa status skipped esperado', () => {
    const previewSlot = {
      provider: 'cloudflare_r2' as const,
      status: 'skipped' as const,
      bucketAlias: null,
      objectKey: null,
      errorCode: 'PREVIEW_NOT_GENERATED',
      errorMessage: 'Preview não gerado no upload legado.',
    };

    assert.equal(previewSlot.status, 'skipped');
    assert.equal(previewSlot.objectKey, null);
  });
});
