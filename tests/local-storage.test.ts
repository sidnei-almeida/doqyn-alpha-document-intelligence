import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, mkdir, access, constants } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { resetStorageProviderCache } from '../server/storage/index.js';
import { createLocalStorageProvider } from '../server/storage/localStorageProvider.js';
import {
  buildDocumentVersionStorageKey,
  resolveStorageAbsolutePath,
} from '../server/storage/storageKeys.js';
import { ServiceError } from '../server/utils/serviceErrors.js';

const TENANT_BUSINESS = 'company_dev';
const TENANT_INDIVIDUAL = 'individual_maria_ab12cd';
const DOCUMENT_ID = 'doc_abc123';
const VERSION_ID = 'ver_xyz789';

describe('local storage provider', () => {
  let tempRoot = '';

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), 'doqyn-storage-'));
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

  function createProvider(maxUploadMb = 25) {
    return createLocalStorageProvider({
      provider: 'local',
      localRoot: tempRoot,
      maxUploadBytes: maxUploadMb * 1024 * 1024,
    });
  }

  it('salva arquivo no diretório esperado', async () => {
    const provider = createProvider();
    const buffer = Buffer.from('%PDF-1.4 test');

    const stored = await provider.storeDocumentVersion({
      tenantId: TENANT_BUSINESS,
      documentId: DOCUMENT_ID,
      versionId: VERSION_ID,
      buffer,
      mimeType: 'application/pdf',
      extension: 'pdf',
    });

    assert.match(
      stored.storageKey,
      /^documents\/company_dev\/doc_abc123\/versions\/ver_xyz789\/original\.pdf$/,
    );
    assert.equal(stored.storageKey.includes('/var/'), false);

    const absolute = resolveStorageAbsolutePath(tempRoot, stored.storageKey);
    await access(absolute, constants.F_OK);
  });

  it('cria subpastas automaticamente', async () => {
    const provider = createProvider();
    await provider.storeDocumentVersion({
      tenantId: TENANT_INDIVIDUAL,
      documentId: DOCUMENT_ID,
      versionId: VERSION_ID,
      buffer: Buffer.from('hello'),
      mimeType: 'text/plain',
      extension: 'txt',
    });

    const key = buildDocumentVersionStorageKey({
      tenantId: TENANT_INDIVIDUAL,
      documentId: DOCUMENT_ID,
      versionId: VERSION_ID,
      extension: 'txt',
    });
    const absolute = resolveStorageAbsolutePath(tempRoot, key);
    await access(path.dirname(absolute), constants.F_OK);
  });

  it('rejeita path traversal na leitura', async () => {
    const provider = createProvider();
    await assert.rejects(
      () => provider.readDocumentVersion('../secrets.txt'),
      (error: ServiceError) => error.code === 'INVALID_STORAGE_KEY',
    );
  });

  it('rejeita leitura fora do root', async () => {
    assert.throws(
      () => resolveStorageAbsolutePath(tempRoot, '../../etc/passwd'),
      (error: ServiceError) =>
        error.code === 'INVALID_STORAGE_KEY' || error.code === 'STORAGE_PATH_TRAVERSAL',
    );
  });

  it('respeita MAX_UPLOAD_MB', async () => {
    const provider = createProvider(1);
    const tooLarge = Buffer.alloc(2 * 1024 * 1024, 1);

    await assert.rejects(
      () =>
        provider.storeDocumentVersion({
          tenantId: TENANT_BUSINESS,
          documentId: DOCUMENT_ID,
          versionId: VERSION_ID,
          buffer: tooLarge,
          mimeType: 'application/pdf',
        }),
      (error: ServiceError) => error.code === 'FILE_TOO_LARGE',
    );
  });

  it('erro claro se LOCAL_STORAGE_ROOT não existe', async () => {
    const missingRoot = path.join(tempRoot, 'missing');
    const provider = createLocalStorageProvider({
      provider: 'local',
      localRoot: missingRoot,
      maxUploadBytes: 25 * 1024 * 1024,
    });

    await assert.rejects(
      () => provider.ensureReady(),
      (error: ServiceError) => error.code === 'STORAGE_ROOT_NOT_FOUND',
    );
  });

  it('erro claro se LOCAL_STORAGE_ROOT não é gravável', async () => {
    const readOnlyRoot = path.join(tempRoot, 'readonly');
    await mkdir(readOnlyRoot, { recursive: true });
    await writeFile(path.join(readOnlyRoot, '.keep'), 'x');

    const { chmod } = await import('node:fs/promises');
    let chmodApplied = false;
    try {
      await chmod(readOnlyRoot, 0o555);
      chmodApplied = true;
    } catch {
      return;
    }

    const provider = createLocalStorageProvider({
      provider: 'local',
      localRoot: readOnlyRoot,
      maxUploadBytes: 25 * 1024 * 1024,
    });

    await assert.rejects(
      () => provider.ensureReady(),
      (error: ServiceError) => error.code === 'STORAGE_ROOT_NOT_WRITABLE',
    );

    if (chmodApplied) {
      await chmod(readOnlyRoot, 0o700).catch(() => undefined);
    }
  });

  it('storageKey é relativa sem path absoluto', async () => {
    const provider = createProvider();
    const stored = await provider.storeDocumentVersion({
      tenantId: TENANT_BUSINESS,
      documentId: DOCUMENT_ID,
      versionId: VERSION_ID,
      buffer: Buffer.from('data'),
      mimeType: 'application/pdf',
    });

    assert.ok(!path.isAbsolute(stored.storageKey));
    assert.ok(!stored.storageKey.includes(tempRoot));
  });

  it('business e individual geram paths seguros sem CPF/CNPJ', async () => {
    const provider = createProvider();

    const business = await provider.storeDocumentVersion({
      tenantId: TENANT_BUSINESS,
      documentId: DOCUMENT_ID,
      versionId: VERSION_ID,
      buffer: Buffer.from('b'),
      mimeType: 'application/pdf',
    });

    const individual = await provider.storeDocumentVersion({
      tenantId: TENANT_INDIVIDUAL,
      documentId: 'doc_ind_1',
      versionId: 'ver_ind_1',
      buffer: Buffer.from('i'),
      mimeType: 'application/pdf',
    });

    for (const key of [business.storageKey, individual.storageKey]) {
      assert.match(key, /^documents\/[a-z][a-z0-9_]+\/[a-zA-Z0-9_-]+\/versions\/[a-zA-Z0-9_-]+\/original\.[a-z0-9]+$/);
      assert.ok(!/\d{11}|\d{14}/.test(key));
    }
  });

  it('leitura retorna buffer do arquivo salvo', async () => {
    const provider = createProvider();
    const payload = Buffer.from('conteudo-do-arquivo');

    const stored = await provider.storeDocumentVersion({
      tenantId: TENANT_BUSINESS,
      documentId: DOCUMENT_ID,
      versionId: VERSION_ID,
      buffer: payload,
      mimeType: 'application/pdf',
    });

    const read = await provider.readDocumentVersion(stored.storageKey);
    assert.deepEqual(read.buffer, payload);
  });
});
