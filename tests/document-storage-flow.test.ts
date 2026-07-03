import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, constants, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  getStorageProvider,
  resetStorageProviderCache,
  storeAnalysisStaging,
  loadAnalysisStaging,
  deleteAnalysisStaging,
} from '../server/storage/index.js';
import { resolveStorageAbsolutePath } from '../server/storage/storageKeys.js';
import { storeUploadedDocumentFile } from '../server/services/documentFileService.js';
import { resolveStorageFileNames } from '../server/utils/resolveStorageFileNames.js';

const TENANT = 'company_dev';
const USER = 'user_test_flow';
const JOB_ID = 'job_test_staging_001';
const DOCUMENT_ID = 'doc_flow_001';
const VERSION_ID = 'ver_flow_001';
const RECOMMENDED_NAME = 'NDA_Confidencial_Recomendado.pdf';
const RESOLVED_RECOMMENDED = resolveStorageFileNames({
  originalFileName: 'entrada.pdf',
  aiSuggestedFileName: RECOMMENDED_NAME,
  namingMode: 'ai_suggested',
}).storageFileName;

describe('fluxo documento — staging e confirm', () => {
  let tempRoot = '';

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), 'doqyn-flow-'));
    process.env.STORAGE_PROVIDER = 'local';
    process.env.LOCAL_STORAGE_ROOT = tempRoot;
    process.env.MAX_UPLOAD_MB = '25';
    resetStorageProviderCache();
  });

  afterEach(async () => {
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
    delete process.env.STORAGE_PROVIDER;
    delete process.env.LOCAL_STORAGE_ROOT;
    delete process.env.MAX_UPLOAD_MB;
    resetStorageProviderCache();
  });

  it('analyze-pdf staging persiste PDF temporário com hash verificável', async () => {
    const buffer = Buffer.from('%PDF-1.4 fluxo-staging');
    const hash = createHash('sha256').update(buffer).digest('hex');

    const stagingKey = await storeAnalysisStaging({
      tenantId: TENANT,
      ownerUserId: USER,
      jobId: JOB_ID,
      buffer,
      mimeType: 'application/pdf',
      originalFileName: 'original-upload.pdf',
    });

    assert.match(stagingKey, /^staging\/company_dev\/user_test_flow\/job_test_staging_001\/original\.pdf$/);
    assert.ok(!path.isAbsolute(stagingKey));

    const loaded = await loadAnalysisStaging({
      tenantId: TENANT,
      ownerUserId: USER,
      jobId: JOB_ID,
      expectedSha256: hash,
      mimeType: 'application/pdf',
      originalFileName: 'original-upload.pdf',
    });

    assert.deepEqual(loaded, buffer);
  });

  it('confirm-analysis promove staging para storage.primary stored', async () => {
    const buffer = Buffer.from('%PDF-1.4 confirm-flow');
    const hash = createHash('sha256').update(buffer).digest('hex');

    await storeAnalysisStaging({
      tenantId: TENANT,
      ownerUserId: USER,
      jobId: JOB_ID,
      buffer,
      mimeType: 'application/pdf',
      originalFileName: 'entrada.pdf',
      storageFileName: 'entrada.pdf',
    });

    const storage = await storeUploadedDocumentFile({
      tenantId: TENANT,
      documentId: DOCUMENT_ID,
      versionId: VERSION_ID,
      buffer: await loadAnalysisStaging({
        tenantId: TENANT,
        ownerUserId: USER,
        jobId: JOB_ID,
        expectedSha256: hash,
        mimeType: 'application/pdf',
        originalFileName: 'entrada.pdf',
      }),
      mimeType: 'application/pdf',
      originalFileName: 'entrada.pdf',
      storageFileName: 'entrada.pdf',
    });

    await deleteAnalysisStaging({
      tenantId: TENANT,
      ownerUserId: USER,
      jobId: JOB_ID,
      mimeType: 'application/pdf',
      originalFileName: 'entrada.pdf',
      storageFileName: 'entrada.pdf',
    });

    assert.equal(storage.primary.provider, 'local');
    assert.equal(storage.primary.status, 'stored');
    assert.ok(storage.primary.objectKey);
    assert.ok(!storage.primary.objectKey!.includes(tempRoot));
    assert.ok(!path.isAbsolute(storage.primary.objectKey!));

    const absolute = resolveStorageAbsolutePath(tempRoot, storage.primary.objectKey!);
    await access(absolute, constants.F_OK);
  });

  it('confirm-analysis mantém objectKey da versão após promoção', async () => {
    const buffer = Buffer.from('versao-estavel');
    const hash = createHash('sha256').update(buffer).digest('hex');

    await storeAnalysisStaging({
      tenantId: TENANT,
      ownerUserId: USER,
      jobId: JOB_ID,
      buffer,
      mimeType: 'application/pdf',
      originalFileName: 'doc.pdf',
      storageFileName: 'doc.pdf',
    });

    const firstStorage = await storeUploadedDocumentFile({
      tenantId: TENANT,
      documentId: DOCUMENT_ID,
      versionId: VERSION_ID,
      buffer: await loadAnalysisStaging({
        tenantId: TENANT,
        ownerUserId: USER,
        jobId: JOB_ID,
        expectedSha256: hash,
        mimeType: 'application/pdf',
        originalFileName: 'doc.pdf',
      }),
      mimeType: 'application/pdf',
      originalFileName: 'doc.pdf',
      storageFileName: 'doc.pdf',
    });

    const objectKey = firstStorage.primary.objectKey;
    assert.ok(objectKey);

    const provider = getStorageProvider();
    assert.ok(provider);
    const read = await provider.readDocumentVersion(objectKey!);
    assert.deepEqual(read.buffer, buffer);
  });

  it('nome final sanitizado compõe path físico no storage', async () => {
    const buffer = Buffer.from('nome-logico-apenas');

    const storage = await storeUploadedDocumentFile({
      tenantId: TENANT,
      documentId: DOCUMENT_ID,
      versionId: VERSION_ID,
      buffer,
      mimeType: 'application/pdf',
      originalFileName: 'original.pdf',
      storageFileName: RESOLVED_RECOMMENDED,
    });

    const objectKey = storage.primary.objectKey!;
    assert.match(objectKey, new RegExp(`/original/${RESOLVED_RECOMMENDED.replace('.', '\\.')}$`));
    assert.ok(objectKey.includes('NDA_Confidencial_Recomendado'));
    assert.ok(!objectKey.endsWith('/original.pdf'));
  });

  it('upload direto cria storage.primary stored com STORAGE_PROVIDER=local', async () => {
    const storage = await storeUploadedDocumentFile({
      tenantId: TENANT,
      documentId: DOCUMENT_ID,
      versionId: VERSION_ID,
      buffer: Buffer.from('%PDF upload-direto'),
      mimeType: 'application/pdf',
      originalFileName: 'contrato.pdf',
      storageFileName: 'contrato.pdf',
    });

    assert.equal(storage.primary.provider, 'local');
    assert.equal(storage.primary.status, 'stored');
    assert.match(storage.primary.objectKey!, /^documents\/company_dev\//);
  });

  it('download falha se arquivo não existir no disco', async () => {
    const provider = getStorageProvider();
    assert.ok(provider);

    const storage = await storeUploadedDocumentFile({
      tenantId: TENANT,
      documentId: DOCUMENT_ID,
      versionId: VERSION_ID,
      buffer: Buffer.from('temp'),
      mimeType: 'application/pdf',
      originalFileName: 'x.pdf',
      storageFileName: 'x.pdf',
    });

    const objectKey = storage.primary.objectKey!;
    await provider.deleteDocumentVersion(objectKey);

    await assert.rejects(() => provider.readDocumentVersion(objectKey));
  });

  it('download funciona quando arquivo existe', async () => {
    const payload = Buffer.from('conteudo-download-ok');
    const provider = getStorageProvider();
    assert.ok(provider);

    const storage = await storeUploadedDocumentFile({
      tenantId: TENANT,
      documentId: DOCUMENT_ID,
      versionId: VERSION_ID,
      buffer: payload,
      mimeType: 'application/pdf',
      originalFileName: 'ok.pdf',
      storageFileName: 'ok.pdf',
    });

    const read = await provider!.readDocumentVersion(storage.primary.objectKey!);
    assert.deepEqual(read.buffer, payload);
  });

  it('staging ausente impede confirmação com erro claro', async () => {
    await assert.rejects(
      () =>
        loadAnalysisStaging({
          tenantId: TENANT,
          ownerUserId: USER,
          jobId: 'job_inexistente',
          expectedSha256: 'a'.repeat(64),
          mimeType: 'application/pdf',
          originalFileName: 'x.pdf',
        }),
      (error: { code?: string }) => error.code === 'STAGING_FILE_NOT_FOUND',
    );
  });
});
