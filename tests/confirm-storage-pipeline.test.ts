import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  loadAnalysisStaging,
  resetStorageProviderCache,
  storeAnalysisStaging,
} from '../server/storage/index.js';
import { storeUploadedDocumentFile } from '../server/services/documentFileService.js';
import { resolveStorageFileNames } from '../server/utils/resolveStorageFileNames.js';
import { buildFilenameUpdatedAuditEvent } from '../server/audit/buildFilenameUpdatedAuditEvent.js';
import { sanitizeAuditMetadata } from '../server/utils/sanitizeAuditMetadata.js';

const TENANT = 'company_dev';
const USER = 'user_confirm_pipeline';
const JOB_ID = 'job_confirm_pipeline_001';
const DOCUMENT_ID = 'doc_confirm_pipeline';
const VERSION_ID = 'ver_confirm_pipeline';

describe('confirm storage pipeline — integração local', () => {
  let tempRoot = '';

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), 'doqyn-confirm-pipeline-'));
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

  it('staging → resolve → store produz objectKey com storageFileName', async () => {
    const buffer = Buffer.from('%PDF-1.4 confirm-pipeline');
    const hash = createHash('sha256').update(buffer).digest('hex');
    const storageFileName = 'NDA_Confidencialidade_2026-07-02_v1.pdf';

    await storeAnalysisStaging({
      tenantId: TENANT,
      ownerUserId: USER,
      jobId: JOB_ID,
      buffer,
      mimeType: 'application/pdf',
      originalFileName: 'original.pdf',
    });

    const resolved = resolveStorageFileNames({
      originalFileName: 'original.pdf',
      aiSuggestedFileName: storageFileName,
      namingMode: 'ai_suggested',
      finalFileName: storageFileName,
      documentId: DOCUMENT_ID,
      versionLabel: 'v1',
    });

    const loaded = await loadAnalysisStaging({
      tenantId: TENANT,
      ownerUserId: USER,
      jobId: JOB_ID,
      expectedSha256: hash,
      mimeType: 'application/pdf',
      originalFileName: 'original.pdf',
    });

    const storage = await storeUploadedDocumentFile({
      tenantId: TENANT,
      documentId: DOCUMENT_ID,
      versionId: VERSION_ID,
      buffer: loaded,
      mimeType: 'application/pdf',
      originalFileName: 'original.pdf',
      storageFileName: resolved.storageFileName,
    });

    const objectKey = storage.primary.objectKey!;
    assert.equal(resolved.finalFileName, storageFileName);
    assert.equal(resolved.storageFileName, storageFileName);
    assert.equal(resolved.previewStorageFileName, 'NDA_Confidencialidade_2026-07-02_v1_preview.pdf');
    assert.ok(resolved.previewStorageFileName.endsWith('_preview.pdf'));
    assert.match(objectKey, /\/original\/NDA_Confidencialidade_2026-07-02_v1\.pdf$/);
    assert.ok(!objectKey.endsWith('/original.pdf'));
    assert.ok(!objectKey.endsWith('/original/original.pdf'));
    assert.equal(objectKey.includes('12345678901'), false);
    assert.equal(objectKey.includes('@'), false);
    assert.equal(storage.primary.status, 'stored');
  });

  it('original.pdf no modo original usa fallback no objectKey', async () => {
    const buffer = Buffer.from('%PDF-1.4 fallback');
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
      buffer,
      mimeType: 'application/pdf',
      originalFileName: 'original.pdf',
      storageFileName: resolved.storageFileName,
    });

    assert.ok(resolved.storageFileName.startsWith('Documento_'));
    assert.ok(!storage.primary.objectKey!.endsWith('/original.pdf'));
  });

  it('storage_promoted metadata seguro contém storageFileName', () => {
    const storageFileName = 'NDA_Confidencialidade_v1.pdf';
    const metadata = sanitizeAuditMetadata({
      storageProvider: 'local',
      storageStatus: 'stored',
      namingMode: 'ai_suggested',
      storageFileName,
      previewStorageFileName: 'NDA_Confidencialidade_v1_preview.pdf',
      source: 'api',
    });

    assert.equal(metadata.storageFileName, storageFileName);
    assert.equal(metadata.previewStorageFileName, 'NDA_Confidencialidade_v1_preview.pdf');
    assert.equal('objectKey' in metadata, false);
  });
});

describe('buildFilenameUpdatedAuditEvent', () => {
  it('emite quando usuário altera nome da IA', () => {
    const resolved = resolveStorageFileNames({
      originalFileName: 'upload.pdf',
      aiSuggestedFileName: 'NDA_Sugerido_IA.pdf',
      namingMode: 'manual',
      manualName: 'NDA_Manual_Final.pdf',
      documentId: DOCUMENT_ID,
      versionLabel: 'v1',
    });

    const event = buildFilenameUpdatedAuditEvent({
      namingMode: 'manual',
      originalFileName: 'upload.pdf',
      aiSuggestedFileName: resolved.aiSuggestedFileName,
      selectedFileName: 'NDA_Manual_Final.pdf',
      resolved,
      documentId: DOCUMENT_ID,
      versionId: VERSION_ID,
      occurredAt: new Date(),
    });

    assert.ok(event);
    assert.equal(event?.action, 'document.filename_updated');
    assert.equal(event?.metadata?.namingMode, 'manual');
  });

  it('não emite quando finalFileName igual à sugestão', () => {
    const resolved = resolveStorageFileNames({
      originalFileName: 'upload.pdf',
      aiSuggestedFileName: 'NDA_Igual.pdf',
      namingMode: 'ai_suggested',
      finalFileName: 'NDA_Igual.pdf',
      documentId: DOCUMENT_ID,
      versionLabel: 'v1',
    });

    const event = buildFilenameUpdatedAuditEvent({
      namingMode: 'ai_suggested',
      originalFileName: 'upload.pdf',
      aiSuggestedFileName: 'NDA_Igual.pdf',
      resolved,
      documentId: DOCUMENT_ID,
      versionId: VERSION_ID,
      occurredAt: new Date(),
    });

    assert.equal(event, null);
  });

  it('sanitiza CPF/CNPJ/e-mail no evento', () => {
    const resolved = resolveStorageFileNames({
      originalFileName: 'upload.pdf',
      aiSuggestedFileName: 'NDA_12345678901.pdf',
      namingMode: 'manual',
      manualName: 'NDA_Manual.pdf',
      documentId: DOCUMENT_ID,
      versionLabel: 'v1',
    });

    const event = buildFilenameUpdatedAuditEvent({
      namingMode: 'manual',
      originalFileName: 'upload.pdf',
      aiSuggestedFileName: 'NDA_12345678901_contato@empresa.com.pdf',
      resolved,
      documentId: DOCUMENT_ID,
      versionId: VERSION_ID,
      occurredAt: new Date(),
    });

    assert.ok(event);
    const sanitized = sanitizeAuditMetadata({
      changes: event?.changes,
      before: event?.before,
      after: event?.after,
    });
    const changes = sanitized.changes as Array<{ before: string }>;
    assert.equal(changes[0]?.before.includes('12345678901'), false);
    assert.equal(changes[0]?.before.includes('@'), false);
    assert.equal('password' in sanitized, false);
    assert.equal('token' in sanitized, false);
  });
});
