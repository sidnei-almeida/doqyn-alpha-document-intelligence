import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import type { TenantStorageScope } from '../../tenancy/resolveTenantStorageScope.js';
import type { StorageConfig } from '../storageConfig.js';
import {
  buildAnalysisStagingKey,
  buildDocumentPreviewObjectKey,
  buildDocumentVersionObjectKey,
  sanitizeFileExtension,
} from '../storageKeys.js';
import type {
  ReadDocumentVersionResult,
  StagingCapableStorageProvider,
  StoreDocumentPreviewInput,
  StoreDocumentVersionInput,
  StorePreviewAssetInput,
  StoredDocumentPreview,
  StoredDocumentVersion,
} from '../storageProvider.js';
import { ServiceError } from '../../utils/serviceErrors.js';
import { createR2RuntimeClient } from './r2Clients.js';
import {
  ensureBucketForStorageScope,
  ensureTenantBucket,
  resolveTenantBucketName,
} from './r2BucketProvisioner.js';
import { markTenantBucketReady } from '../../services/tenantStorageConfigService.js';
import type { R2Config } from '../storageConfig.js';

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);

  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export type R2StorageProviderDeps = {
  runtimeClient?: S3Client;
  ensureBucket?: typeof ensureTenantBucket;
  ensureBucketForScope?: typeof ensureBucketForStorageScope;
};

export class R2StorageProvider implements StagingCapableStorageProvider {
  readonly name = 'r2' as const;
  private config: StorageConfig;
  private r2: R2Config;
  private runtimeClient: S3Client;
  private ensureBucketFn: typeof ensureTenantBucket;
  private ensureBucketForScopeFn: typeof ensureBucketForStorageScope;

  constructor(config: StorageConfig, deps: R2StorageProviderDeps = {}) {
    if (!config.r2) {
      throw new ServiceError('Configuração R2 ausente.', 'R2_CONFIG_MISSING', 500);
    }
    this.config = config;
    this.r2 = config.r2;
    this.runtimeClient = deps.runtimeClient ?? createR2RuntimeClient(this.r2);
    this.ensureBucketFn = deps.ensureBucket ?? ensureTenantBucket;
    this.ensureBucketForScopeFn = deps.ensureBucketForScope ?? ensureBucketForStorageScope;
  }

  async ensureReady(): Promise<void> {
    if (!this.r2.runtimeAccessKeyId || !this.r2.runtimeSecretAccessKey) {
      throw new ServiceError(
        'Credenciais runtime R2 não configuradas.',
        'R2_RUNTIME_CREDENTIALS_MISSING',
        500,
      );
    }
  }

  /** @deprecated legado — preferir resolveBucketFromScope */
  private async resolveBucket(tenantId: string): Promise<string> {
    const { bucket } = await this.ensureBucketFn({
      tenantId,
      config: this.r2,
    });
    return bucket;
  }

  private async resolveBucketFromScope(scope: TenantStorageScope): Promise<string> {
    const { bucket } = await this.ensureBucketForScopeFn({
      bucketMode: scope.bucketMode,
      bucketName: scope.bucketName,
      tenantId: scope.tenantId,
      config: this.r2,
    });

    if (scope.bucketMode === 'per_tenant') {
      await markTenantBucketReady(scope.tenantId, bucket).catch(() => undefined);
    }

    return bucket;
  }

  private resolveReadBucket(
    tenantId: string,
    bucketAlias?: string | null,
    storageScope?: TenantStorageScope,
  ): string {
    if (bucketAlias?.trim()) {
      return bucketAlias.trim();
    }

    if (storageScope) {
      return storageScope.bucketName;
    }

    if (this.r2.bucketMode === 'shared') {
      return this.r2.defaultBucket;
    }

    return resolveTenantBucketName(tenantId, this.r2);
  }

  async storeDocumentVersion(input: StoreDocumentVersionInput): Promise<StoredDocumentVersion> {
    await this.ensureReady();

    if (input.buffer.length > this.config.maxUploadBytes) {
      throw new ServiceError(
        `Arquivo excede o limite de ${Math.floor(this.config.maxUploadBytes / (1024 * 1024))} MB.`,
        'FILE_TOO_LARGE',
        413,
      );
    }

    const scope = input.storageScope;
    const keyPrefix = scope?.keyPrefix ?? this.r2.keyPrefix;
    const basePrefix = scope?.basePrefix;

    const storageKey = buildDocumentVersionObjectKey({
      documentId: input.documentId,
      versionId: input.versionId,
      storageFileName: input.storageFileName,
      keyPrefix,
      basePrefix,
    });

    const bucket = scope
      ? await this.resolveBucketFromScope(scope)
      : await this.resolveBucket(input.tenantId);

    const result = await this.runtimeClient.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: storageKey,
        Body: input.buffer,
        ContentType: input.mimeType || 'application/octet-stream',
      }),
    );

    return {
      storageKey,
      sizeBytes: input.buffer.length,
      provider: 'r2',
      bucket,
      etag: result.ETag ?? undefined,
      contentType: input.mimeType,
    };
  }

  async readDocumentVersion(
    storageKey: string,
    tenantId: string,
    bucketAlias?: string | null,
    storageScope?: TenantStorageScope,
  ): Promise<ReadDocumentVersionResult> {
    await this.ensureReady();

    const bucket = this.resolveReadBucket(tenantId, bucketAlias, storageScope);

    const result = await this.runtimeClient.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: storageKey,
      }),
    );

    const buffer = await streamToBuffer(result.Body);

    return {
      buffer,
      storageKey,
      sizeBytes: buffer.length,
      bucket,
      etag: result.ETag ?? undefined,
      contentType: result.ContentType ?? undefined,
    };
  }

  async storeDocumentPreview(input: StoreDocumentPreviewInput): Promise<StoredDocumentPreview> {
    await this.ensureReady();

    const scope = input.storageScope;
    const keyPrefix = scope?.keyPrefix ?? this.r2.keyPrefix;
    const basePrefix = scope?.basePrefix;

    const storageKey = buildDocumentPreviewObjectKey({
      documentId: input.documentId,
      versionId: input.versionId,
      previewStorageFileName: input.previewStorageFileName,
      keyPrefix,
      basePrefix,
    });

    const bucket = scope
      ? await this.resolveBucketFromScope(scope)
      : await this.resolveBucket(input.tenantId);

    const result = await this.runtimeClient.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: storageKey,
        Body: input.buffer,
        ContentType: 'application/pdf',
      }),
    );

    return {
      storageKey,
      sizeBytes: input.buffer.length,
      provider: 'r2',
      bucket,
      etag: result.ETag ?? undefined,
      contentType: 'application/pdf',
    };
  }

  async storePreviewAsset(input: StorePreviewAssetInput): Promise<StoredDocumentPreview> {
    await this.ensureReady();

    const scope = input.storageScope;
    const bucket = scope
      ? await this.resolveBucketFromScope(scope)
      : input.bucketAlias
        ? await this.resolveBucket(input.tenantId)
        : await this.resolveBucket(input.tenantId);

    const result = await this.runtimeClient.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: input.objectKey,
        Body: input.buffer,
        ContentType: input.contentType,
      }),
    );

    return {
      storageKey: input.objectKey,
      sizeBytes: input.buffer.length,
      provider: 'r2',
      bucket,
      etag: result.ETag ?? undefined,
      contentType: input.contentType,
    };
  }

  async readDocumentPreview(
    storageKey: string,
    tenantId: string,
    bucketAlias?: string | null,
    storageScope?: TenantStorageScope,
  ): Promise<ReadDocumentVersionResult> {
    return this.readDocumentVersion(storageKey, tenantId, bucketAlias, storageScope);
  }

  async deleteDocumentVersion(
    storageKey: string,
    tenantId: string,
    bucketAlias?: string | null,
    storageScope?: TenantStorageScope,
  ): Promise<void> {
    await this.ensureReady();

    const bucket = this.resolveReadBucket(tenantId, bucketAlias, storageScope);

    await this.runtimeClient.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: storageKey,
      }),
    );
  }

  async storeStagingFile(input: {
    tenantId: string;
    jobId: string;
    buffer: Buffer;
    mimeType: string;
    originalFileName?: string;
    ownerUserId?: string;
    storageScope?: TenantStorageScope;
  }): Promise<string> {
    await this.ensureReady();

    if (input.buffer.length > this.config.maxUploadBytes) {
      throw new ServiceError(
        `Arquivo excede o limite de ${Math.floor(this.config.maxUploadBytes / (1024 * 1024))} MB.`,
        'FILE_TOO_LARGE',
        413,
      );
    }

    const extension = sanitizeFileExtension({
      extension: input.originalFileName?.split('.').pop(),
      mimeType: input.mimeType,
    });

    const scope = input.storageScope;
    const stagingKey = buildAnalysisStagingKey({
      jobId: input.jobId,
      extension,
      basePrefix: scope?.basePrefix,
    });

    const bucket = scope
      ? await this.resolveBucketFromScope(scope)
      : await this.resolveBucket(input.tenantId);

    await this.runtimeClient.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: stagingKey,
        Body: input.buffer,
        ContentType: input.mimeType || 'application/octet-stream',
      }),
    );

    return stagingKey;
  }

  async loadStagingFile(input: {
    tenantId: string;
    jobId: string;
    mimeType?: string;
    originalFileName?: string;
    ownerUserId?: string;
    storageScope?: TenantStorageScope;
  }): Promise<Buffer> {
    await this.ensureReady();

    const extension = sanitizeFileExtension({
      extension: input.originalFileName?.split('.').pop(),
      mimeType: input.mimeType ?? 'application/pdf',
    });

    const scope = input.storageScope;
    const stagingKey = buildAnalysisStagingKey({
      jobId: input.jobId,
      extension,
      basePrefix: scope?.basePrefix,
    });

    const bucket = scope
      ? await this.resolveBucketFromScope(scope)
      : await this.resolveBucket(input.tenantId);

    const result = await this.runtimeClient.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: stagingKey,
      }),
    );

    return streamToBuffer(result.Body);
  }

  async deleteStagingFile(input: {
    tenantId: string;
    jobId: string;
    mimeType?: string;
    originalFileName?: string;
    ownerUserId?: string;
    storageScope?: TenantStorageScope;
  }): Promise<void> {
    await this.ensureReady();

    const extension = sanitizeFileExtension({
      extension: input.originalFileName?.split('.').pop(),
      mimeType: input.mimeType ?? 'application/pdf',
    });

    const scope = input.storageScope;
    const stagingKey = buildAnalysisStagingKey({
      jobId: input.jobId,
      extension,
      basePrefix: scope?.basePrefix,
    });

    const bucket = scope
      ? await this.resolveBucketFromScope(scope)
      : await this.resolveBucket(input.tenantId);

    await this.runtimeClient.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: stagingKey,
      }),
    );
  }
}

export function createR2StorageProvider(
  config: StorageConfig,
  deps?: R2StorageProviderDeps,
): R2StorageProvider {
  return new R2StorageProvider(config, deps);
}
