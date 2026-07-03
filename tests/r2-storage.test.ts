import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { buildTenantBucketName } from '../server/storage/r2/r2BucketNaming.js';
import { createR2AdminClient, createR2RuntimeClient } from '../server/storage/r2/r2Clients.js';
import {
  createTenantBucket,
  ensureTenantBucket,
  headTenantBucket,
} from '../server/storage/r2/r2BucketProvisioner.js';
import { createR2StorageProvider } from '../server/storage/r2/r2StorageProvider.js';
import { getStorageProvider, resetStorageProviderCache } from '../server/storage/getStorageProvider.js';
import type { R2Config } from '../server/storage/storageConfig.js';
import { validateR2Endpoint } from '../server/storage/storageConfig.js';

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

function createMockClient(handler: (command: unknown) => Promise<unknown>): S3Client {
  return { send: handler } as unknown as S3Client;
}

describe('r2 bucket naming', () => {
  it('não usa CNPJ ou e-mail no bucket amigável', () => {
    const bucket = buildTenantBucketName({
      env: 'dev',
      tenantId: 'company_acme_corp',
      tenantDisplayName: 'Acme Corp Ltda',
      tenantSlug: 'acme-corp',
    }).bucketName;

    assert.match(bucket, /^doqyn-dev-t-acme-corp-[a-f0-9]{12}$/);
    assert.equal(bucket.includes('cnpj'), false);
    assert.equal(bucket.includes('@'), false);
  });

  it('é determinístico para o mesmo tenantId', () => {
    const input = {
      env: 'dev' as const,
      tenantId: 'tenant_uuid_001',
      tenantDisplayName: 'Tenant UUID',
      tenantSlug: 'tenant-uuid',
    };
    const a = buildTenantBucketName(input).bucketName;
    const b = buildTenantBucketName(input).bucketName;
    assert.equal(a, b);
  });
});

describe('r2 clients', () => {
  it('endpoint inválido com sufixo de bucket falha', () => {
    assert.equal(
      validateR2Endpoint('https://abc123.r2.cloudflarestorage.com/doqyn-alpha', 'abc123'),
      false,
    );
  });

  it('runtime client não usa credenciais admin', async () => {
    const client = createR2RuntimeClient(BASE_R2_CONFIG);
    const creds = (client as unknown as { config: { credentials: () => Promise<unknown> } }).config
      .credentials;
    assert.ok(creds);
    const resolved = (await creds()) as { accessKeyId?: string; secretAccessKey?: string };
    assert.equal(resolved.accessKeyId, 'runtime-key-id');
    assert.equal(resolved.secretAccessKey, 'runtime-secret');
  });

  it('admin client não usa credenciais runtime', async () => {
    const client = createR2AdminClient(BASE_R2_CONFIG);
    const creds = (client as unknown as { config: { credentials: () => Promise<unknown> } }).config
      .credentials;
    assert.ok(creds);
    const resolved = (await creds()) as { accessKeyId?: string; secretAccessKey?: string };
    assert.equal(resolved.accessKeyId, 'admin-key-id');
    assert.equal(resolved.secretAccessKey, 'admin-secret');
  });
});

describe('r2 bucket provisioner', () => {
  it('ensureTenantBucket chama HeadBucket e CreateBucket quando necessário', async () => {
    const commands: unknown[] = [];
    const adminClient = createMockClient(async (command) => {
      commands.push(command);
      if (command instanceof HeadBucketCommand) {
        const err = new Error('NotFound');
        (err as { name: string }).name = 'NotFound';
        (err as { $metadata: { httpStatusCode: number } }).$metadata = { httpStatusCode: 404 };
        throw err;
      }
      if (command instanceof CreateBucketCommand) {
        return {};
      }
      return {};
    });

    const result = await ensureTenantBucket({
      tenantId: 'company_dev',
      config: BASE_R2_CONFIG,
      adminClient,
    });

    assert.equal(result.created, true);
    assert.match(result.bucket, /^doqyn-t-[a-f0-9]{12}$/);
    assert.equal(commands.some((c) => c instanceof HeadBucketCommand), true);
    assert.equal(commands.some((c) => c instanceof CreateBucketCommand), true);
  });

  it('ensureTenantBucket é idempotente se bucket já existe', async () => {
    const commands: unknown[] = [];
    const adminClient = createMockClient(async (command) => {
      commands.push(command);
      if (command instanceof HeadBucketCommand) {
        return {};
      }
      return {};
    });

    const result = await ensureTenantBucket({
      tenantId: 'company_dev',
      config: BASE_R2_CONFIG,
      adminClient,
    });

    assert.equal(result.created, false);
    assert.equal(commands.some((c) => c instanceof CreateBucketCommand), false);
  });

  it('createTenantBucket trata BucketAlreadyOwnedByYou como OK', async () => {
    const adminClient = createMockClient(async (command) => {
      if (command instanceof CreateBucketCommand) {
        const err = new Error('BucketAlreadyOwnedByYou');
        (err as { name: string }).name = 'BucketAlreadyOwnedByYou';
        (err as { $metadata: { httpStatusCode: number } }).$metadata = { httpStatusCode: 409 };
        throw err;
      }
      return {};
    });

    await assert.doesNotReject(() => createTenantBucket(adminClient, 'doqyn-t-testbucket1'));
  });

  it('headTenantBucket retorna false para 404', async () => {
    const adminClient = createMockClient(async () => {
      const err = new Error('NotFound');
      (err as { name: string }).name = 'NotFound';
      (err as { $metadata: { httpStatusCode: number } }).$metadata = { httpStatusCode: 404 };
      throw err;
    });

    const exists = await headTenantBucket(adminClient, 'doqyn-t-missing0001');
    assert.equal(exists, false);
  });
});

describe('r2 storage provider', () => {
  const storageConfig = {
    provider: 'r2' as const,
    localRoot: '',
    maxUploadBytes: 25 * 1024 * 1024,
    r2: BASE_R2_CONFIG,
  };

  it('PutObject usa runtime client', async () => {
    const commands: unknown[] = [];
    const runtimeClient = createMockClient(async (command) => {
      commands.push(command);
      if (command instanceof PutObjectCommand) {
        return { ETag: '"etag-123"' };
      }
      return {};
    });

    const ensureBucket = mock.fn(async () => ({
      bucket: 'doqyn-t-a94f3c82d1b4',
      created: false,
    }));

    const provider = createR2StorageProvider(storageConfig, {
      runtimeClient,
      ensureBucket,
    });

    const stored = await provider.storeDocumentVersion({
      tenantId: 'company_dev',
      documentId: 'doc_001',
      versionId: 'ver_001',
      buffer: Buffer.from('%PDF test'),
      mimeType: 'application/pdf',
      extension: 'pdf',
      storageFileName: 'documento.pdf',
    });

    assert.equal(stored.provider, 'r2');
    assert.equal(stored.bucket, 'doqyn-t-a94f3c82d1b4');
    assert.match(stored.storageKey, /^documents\/doc_001\/versions\/ver_001\/original\/documento\.pdf$/);
    assert.equal(stored.etag, '"etag-123"');
    assert.equal(commands.some((c) => c instanceof PutObjectCommand), true);
    assert.equal(ensureBucket.mock.calls.length, 1);
  });

  it('GetObject usa runtime client', async () => {
    const payload = Buffer.from('conteudo-r2');
    const runtimeClient = createMockClient(async (command) => {
      if (command instanceof GetObjectCommand) {
        return { Body: payload, ETag: '"etag-456"', ContentType: 'application/pdf' };
      }
      return {};
    });

    const provider = createR2StorageProvider(storageConfig, {
      runtimeClient,
      ensureBucket: async () => ({ bucket: 'doqyn-t-a94f3c82d1b4', created: false }),
    });

    const read = await provider.readDocumentVersion(
      'documents/doc_001/versions/ver_001/original/documento.pdf',
      'company_dev',
      'doqyn-t-a94f3c82d1b4',
    );

    assert.deepEqual(read.buffer, payload);
    assert.equal(read.bucket, 'doqyn-t-a94f3c82d1b4');
    assert.equal(read.etag, '"etag-456"');
  });

  it('DeleteObject usa runtime client', async () => {
    const commands: unknown[] = [];
    const runtimeClient = createMockClient(async (command) => {
      commands.push(command);
      return {};
    });

    const provider = createR2StorageProvider(storageConfig, {
      runtimeClient,
      ensureBucket: async () => ({ bucket: 'doqyn-t-a94f3c82d1b4', created: false }),
    });

    await provider.deleteDocumentVersion(
      'documents/doc_001/versions/ver_001/original/documento.pdf',
      'company_dev',
      'doqyn-t-a94f3c82d1b4',
    );

    assert.equal(commands.some((c) => c instanceof DeleteObjectCommand), true);
  });
});

describe('getStorageProvider', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetStorageProviderCache();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetStorageProviderCache();
  });

  it('retorna r2 provider quando STORAGE_PROVIDER=r2', () => {
    process.env.STORAGE_PROVIDER = 'r2';
    process.env.R2_ACCOUNT_ID = 'abc123';
    process.env.R2_ENDPOINT = 'https://abc123.r2.cloudflarestorage.com';
    process.env.R2_DEFAULT_BUCKET = 'doqyn-alpha';
    process.env.R2_BUCKET_MODE = 'per_tenant';
    process.env.R2_BUCKET_PREFIX = 'doqyn';
    process.env.R2_KEY_PREFIX = 'documents';
    process.env.R2_REGION = 'auto';
    process.env.R2_ACCESS_KEY_ID = 'runtime-key';
    process.env.R2_SECRET_ACCESS_KEY = 'runtime-secret';
    process.env.R2_ADMIN_ACCESS_KEY_ID = 'admin-key';
    process.env.R2_ADMIN_SECRET_ACCESS_KEY = 'admin-secret';

    const provider = getStorageProvider();
    assert.ok(provider);
    assert.equal(provider?.name, 'r2');
  });

  it('não retorna local quando STORAGE_PROVIDER=r2', () => {
    process.env.STORAGE_PROVIDER = 'r2';
    process.env.R2_ACCOUNT_ID = 'abc123';
    process.env.R2_ENDPOINT = 'https://abc123.r2.cloudflarestorage.com';
    process.env.R2_DEFAULT_BUCKET = 'doqyn-alpha';
    process.env.R2_ACCESS_KEY_ID = 'runtime-key';
    process.env.R2_SECRET_ACCESS_KEY = 'runtime-secret';
    process.env.R2_ADMIN_ACCESS_KEY_ID = 'admin-key';
    process.env.R2_ADMIN_SECRET_ACCESS_KEY = 'admin-secret';

    const provider = getStorageProvider();
    assert.notEqual(provider?.name, 'local');
  });
});
