import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import {
  buildIndividualBasePrefix,
  resolveTenantStorageScope,
} from '../server/tenancy/resolveTenantStorageScope.js';
import { buildTenantBucketName } from '../server/storage/r2/r2BucketNaming.js';
import {
  buildAnalysisStagingKey,
  buildDocumentVersionObjectKey,
} from '../server/storage/storageKeys.js';
import {
  ensureBucketForStorageScope,
  ensureSharedBucket,
  ensureTenantBucket,
} from '../server/storage/r2/r2BucketProvisioner.js';
import { createR2StorageProvider } from '../server/storage/r2/r2StorageProvider.js';
import type { R2Config } from '../server/storage/storageConfig.js';
import { ServiceError } from '../server/utils/serviceErrors.js';

const BASE_R2_CONFIG: R2Config = {
  accountId: 'abc123',
  endpoint: 'https://abc123.r2.cloudflarestorage.com',
  region: 'auto',
  bucketMode: 'per_tenant',
  defaultBucket: 'doqyn-alpha',
  bucketPrefix: 'doqyn',
  keyPrefix: 'documents',
  runtimeAccessKeyId: 'runtime-key-id',
  runtimeSecretAccessKey: 'runtime-secret',
  adminAccessKeyId: 'admin-key-id',
  adminSecretAccessKey: 'admin-secret',
  adminApiToken: '',
};

const BUSINESS_TENANT = 'company_acme_a1b2c3';
const INDIVIDUAL_TENANT = 'individual_maria_d4e5f6';
const OWNER_USER_ID = '11111111-1111-1111-1111-111111111111';

function createMockClient(handler: (command: unknown) => Promise<unknown>): S3Client {
  return { send: handler } as unknown as S3Client;
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

describe('resolveTenantStorageScope', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    setR2Env();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('business resolve bucket próprio e basePrefix vazio', () => {
    const scope = resolveTenantStorageScope({
      tenantId: BUSINESS_TENANT,
      tenantType: 'business',
      ownerUserId: OWNER_USER_ID,
    });

    const expectedBucket = buildTenantBucketName({
      env: 'dev',
      tenantId: BUSINESS_TENANT,
      tenantDisplayName: BUSINESS_TENANT,
      tenantSlug: BUSINESS_TENANT,
    }).bucketName;

    assert.equal(scope.tenantType, 'business');
    assert.equal(scope.bucketMode, 'per_tenant');
    assert.equal(scope.bucketName, expectedBucket);
    assert.equal(scope.basePrefix, '');
    assert.equal(scope.keyPrefix, 'documents');
    assert.equal(scope.provider, 'cloudflare_r2');
  });

  it('individual resolve bucket compartilhado e basePrefix opaco', () => {
    const scope = resolveTenantStorageScope({
      tenantId: INDIVIDUAL_TENANT,
      tenantType: 'individual',
      ownerUserId: OWNER_USER_ID,
    });

    const expectedPrefix = buildIndividualBasePrefix(INDIVIDUAL_TENANT);

    assert.equal(scope.tenantType, 'individual');
    assert.equal(scope.bucketMode, 'shared');
    assert.equal(scope.bucketName, 'doqyn-alpha');
    assert.equal(scope.basePrefix, expectedPrefix);
    assert.match(scope.basePrefix, /^individuals\/[a-f0-9]{16}$/);
    assert.equal(scope.ownerUserId, OWNER_USER_ID);
  });

  it('individual exige ownerUserId', () => {
    assert.throws(
      () =>
        resolveTenantStorageScope({
          tenantId: INDIVIDUAL_TENANT,
          tenantType: 'individual',
        }),
      (error: unknown) =>
        error instanceof ServiceError && error.code === 'OWNER_USER_REQUIRED',
    );
  });
});

describe('storage keys com basePrefix', () => {
  const STORAGE_FILE_NAME = 'Contrato_NDA.pdf';
  const individualPrefix = buildIndividualBasePrefix(INDIVIDUAL_TENANT);

  it('objectKey business sem basePrefix', () => {
    const key = buildDocumentVersionObjectKey({
      documentId: 'doc_001',
      versionId: 'ver_001',
      storageFileName: STORAGE_FILE_NAME,
      keyPrefix: 'documents',
    });

    assert.equal(key, `documents/doc_001/versions/ver_001/original/${STORAGE_FILE_NAME}`);
  });

  it('objectKey individual com basePrefix', () => {
    const key = buildDocumentVersionObjectKey({
      documentId: 'doc_001',
      versionId: 'ver_001',
      storageFileName: STORAGE_FILE_NAME,
      keyPrefix: 'documents',
      basePrefix: individualPrefix,
    });

    assert.equal(
      key,
      `${individualPrefix}/documents/doc_001/versions/ver_001/original/${STORAGE_FILE_NAME}`,
    );
  });

  it('staging business sem basePrefix', () => {
    const key = buildAnalysisStagingKey({ jobId: 'job_001', extension: 'pdf' });
    assert.equal(key, 'tmp/job_001/original.pdf');
  });

  it('staging individual com basePrefix', () => {
    const key = buildAnalysisStagingKey({
      jobId: 'job_001',
      extension: 'pdf',
      basePrefix: individualPrefix,
    });
    assert.equal(key, `${individualPrefix}/tmp/job_001/original.pdf`);
  });

  it('não inclui CPF/CNPJ/displayName nas chaves', () => {
    const key = buildDocumentVersionObjectKey({
      documentId: 'doc_001',
      versionId: 'ver_001',
      storageFileName: STORAGE_FILE_NAME,
      basePrefix: individualPrefix,
    });

    assert.equal(key.includes('12345678901'), false);
    assert.equal(key.includes('maria'), false);
  });
});

describe('r2 provider com storageScope', () => {
  const STORAGE_FILE_NAME = 'Contrato_NDA.pdf';
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    setR2Env();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  const storageConfig = {
    provider: 'r2' as const,
    localRoot: '',
    maxUploadBytes: 25 * 1024 * 1024,
    r2: BASE_R2_CONFIG,
  };

  it('business cria/garante bucket próprio com storageScope', async () => {
    const scope = resolveTenantStorageScope({
      tenantId: BUSINESS_TENANT,
      tenantType: 'business',
      ownerUserId: OWNER_USER_ID,
    });

    const ensureBucketForScope = mock.fn(async () => ({
      bucket: scope.bucketName,
      created: true,
    }));

    const runtimeClient = createMockClient(async (command) => {
      if (command instanceof PutObjectCommand) {
        return { ETag: '"etag-biz"' };
      }
      return {};
    });

    const provider = createR2StorageProvider(storageConfig, {
      runtimeClient,
      ensureBucketForScope,
    });

    const stored = await provider.storeDocumentVersion({
      tenantId: BUSINESS_TENANT,
      documentId: 'doc_biz',
      versionId: 'ver_biz',
      buffer: Buffer.from('%PDF business'),
      mimeType: 'application/pdf',
      extension: 'pdf',
      storageFileName: STORAGE_FILE_NAME,
      storageScope: scope,
    });

    assert.equal(stored.bucket, scope.bucketName);
    assert.match(
      stored.storageKey,
      new RegExp(`^documents/doc_biz/versions/ver_biz/original/${STORAGE_FILE_NAME.replace('.', '\\.')}$`),
    );
    assert.equal(ensureBucketForScope.mock.calls.length, 1);
    assert.deepEqual(ensureBucketForScope.mock.calls[0]?.arguments[0], {
      bucketMode: 'per_tenant',
      bucketName: scope.bucketName,
      tenantId: BUSINESS_TENANT,
      config: BASE_R2_CONFIG,
    });
  });

  it('individual usa bucket compartilhado e não cria bucket por CPF', async () => {
    const scope = resolveTenantStorageScope({
      tenantId: INDIVIDUAL_TENANT,
      tenantType: 'individual',
      ownerUserId: OWNER_USER_ID,
    });

    const ensureBucketForScope = mock.fn(async () => ({
      bucket: 'doqyn-alpha',
      created: false,
    }));

    const runtimeClient = createMockClient(async (command) => {
      if (command instanceof PutObjectCommand) {
        const input = command.input;
        assert.equal(input.Bucket, 'doqyn-alpha');
        assert.match(
          String(input.Key),
          new RegExp(`^${scope.basePrefix}/documents/doc_ind/`),
        );
        return { ETag: '"etag-ind"' };
      }
      return {};
    });

    const provider = createR2StorageProvider(storageConfig, {
      runtimeClient,
      ensureBucketForScope,
    });

    const stored = await provider.storeDocumentVersion({
      tenantId: INDIVIDUAL_TENANT,
      documentId: 'doc_ind',
      versionId: 'ver_ind',
      buffer: Buffer.from('%PDF individual'),
      mimeType: 'application/pdf',
      extension: 'pdf',
      storageFileName: STORAGE_FILE_NAME,
      storageScope: scope,
    });

    assert.equal(stored.bucket, 'doqyn-alpha');
    assert.equal(
      stored.storageKey,
      `${scope.basePrefix}/documents/doc_ind/versions/ver_ind/original/${STORAGE_FILE_NAME}`,
    );
    assert.equal(ensureBucketForScope.mock.calls.length, 1);
    assert.equal(ensureBucketForScope.mock.calls[0]?.arguments[0].bucketMode, 'shared');
    assert.equal(ensureBucketForScope.mock.calls[0]?.arguments[0].bucketName, 'doqyn-alpha');
  });

  it('download legado respeita bucketAlias e objectKey salvos', async () => {
    const legacyBucket = 'doqyn-t-legacybucket1';
    const legacyKey = 'documents/doc_old/versions/ver_old/original.pdf';
    const payload = Buffer.from('legado');

    const runtimeClient = createMockClient(async (command) => {
      if (command instanceof GetObjectCommand) {
        assert.equal(command.input.Bucket, legacyBucket);
        assert.equal(command.input.Key, legacyKey);
        return { Body: payload, ContentType: 'application/pdf' };
      }
      return {};
    });

    const ensureBucketForScope = mock.fn(async () => {
      throw new Error('não deve provisionar bucket na leitura legada');
    });

    const provider = createR2StorageProvider(storageConfig, {
      runtimeClient,
      ensureBucketForScope,
    });

    const read = await provider.readDocumentVersion(legacyKey, BUSINESS_TENANT, legacyBucket);

    assert.deepEqual(read.buffer, payload);
    assert.equal(read.bucket, legacyBucket);
    assert.equal(ensureBucketForScope.mock.calls.length, 0);
  });
});

describe('ensureBucketForStorageScope', () => {
  it('shared garante R2_DEFAULT_BUCKET sem hash de tenant', async () => {
    const commands: unknown[] = [];
    const adminClient = createMockClient(async (command) => {
      commands.push(command);
      if (command instanceof HeadBucketCommand) {
        return {};
      }
      return {};
    });

    const result = await ensureBucketForStorageScope({
      bucketMode: 'shared',
      bucketName: 'doqyn-alpha',
      tenantId: INDIVIDUAL_TENANT,
      config: BASE_R2_CONFIG,
      adminClient,
    });

    assert.equal(result.bucket, 'doqyn-alpha');
    assert.equal(result.created, false);
    assert.equal(commands.some((c) => c instanceof HeadBucketCommand), true);
    assert.equal(commands.some((c) => c instanceof CreateBucketCommand), false);
  });

  it('per_tenant garante bucket derivado do tenantId', async () => {
    const adminClient = createMockClient(async (command) => {
      if (command instanceof HeadBucketCommand) {
        return {};
      }
      return {};
    });

    const result = await ensureTenantBucket({
      tenantId: BUSINESS_TENANT,
      config: BASE_R2_CONFIG,
      adminClient,
    });

    assert.match(result.bucket, /^doqyn-t-[a-f0-9]{12}$/);
  });

  it('ensureSharedBucket cria bucket compartilhado quando ausente', async () => {
    const commands: unknown[] = [];
    const adminClient = createMockClient(async (command) => {
      commands.push(command);
      if (command instanceof HeadBucketCommand) {
        const err = new Error('NotFound');
        (err as { name: string }).name = 'NotFound';
        (err as { $metadata: { httpStatusCode: number } }).$metadata = { httpStatusCode: 404 };
        throw err;
      }
      return {};
    });

    const result = await ensureSharedBucket({
      bucketName: 'doqyn-alpha',
      config: BASE_R2_CONFIG,
      adminClient,
    });

    assert.equal(result.created, true);
    assert.equal(result.bucket, 'doqyn-alpha');
    assert.equal(commands.some((c) => c instanceof CreateBucketCommand), true);
  });
});

describe('basePrefix determinístico', () => {
  it('hash16 é estável para o mesmo tenantId', () => {
    const a = buildIndividualBasePrefix(INDIVIDUAL_TENANT);
    const b = buildIndividualBasePrefix(INDIVIDUAL_TENANT);
    assert.equal(a, b);

    const hash = createHash('sha256').update(INDIVIDUAL_TENANT.toLowerCase()).digest('hex').slice(0, 16);
    assert.equal(a, `individuals/${hash}`);
  });
});
