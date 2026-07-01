import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import type { StorageConfig } from '../storageConfig.js';
import {
  buildAnalysisStagingKey,
  buildDocumentVersionObjectKey,
  sanitizeFileExtension,
} from '../storageKeys.js';
import type {
  ReadDocumentVersionResult,
  StagingCapableStorageProvider,
  StoreDocumentVersionInput,
  StoredDocumentVersion,
} from '../storageProvider.js';
import { ServiceError } from '../../utils/serviceErrors.js';
import { createR2RuntimeClient } from './r2Clients.js';
import { ensureTenantBucket, resolveTenantBucketName } from './r2BucketProvisioner.js';
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
};

export class R2StorageProvider implements StagingCapableStorageProvider {
  readonly name = 'r2' as const;
  private config: StorageConfig;
  private r2: R2Config;
  private runtimeClient: S3Client;
  private ensureBucketFn: typeof ensureTenantBucket;

  constructor(config: StorageConfig, deps: R2StorageProviderDeps = {}) {
    if (!config.r2) {
      throw new ServiceError('Configuração R2 ausente.', 'R2_CONFIG_MISSING', 500);
    }
    this.config = config;
    this.r2 = config.r2;
    this.runtimeClient = deps.runtimeClient ?? createR2RuntimeClient(this.r2);
    this.ensureBucketFn = deps.ensureBucket ?? ensureTenantBucket;
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

  private async resolveBucket(tenantId: string): Promise<string> {
    const { bucket } = await this.ensureBucketFn({
      tenantId,
      config: this.r2,
    });
    return bucket;
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

    const extension = sanitizeFileExtension({
      extension: input.extension,
      mimeType: input.mimeType,
    });

    const storageKey = buildDocumentVersionObjectKey({
      documentId: input.documentId,
      versionId: input.versionId,
      extension,
      keyPrefix: this.r2.keyPrefix,
    });

    const bucket = await this.resolveBucket(input.tenantId);

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
  ): Promise<ReadDocumentVersionResult> {
    await this.ensureReady();

    const bucket =
      bucketAlias?.trim() ||
      (this.r2.bucketMode === 'shared'
        ? this.r2.defaultBucket
        : resolveTenantBucketName(tenantId, this.r2));

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

  async deleteDocumentVersion(
    storageKey: string,
    tenantId: string,
    bucketAlias?: string | null,
  ): Promise<void> {
    await this.ensureReady();

    const bucket =
      bucketAlias?.trim() ||
      (this.r2.bucketMode === 'shared'
        ? this.r2.defaultBucket
        : resolveTenantBucketName(tenantId, this.r2));

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

    const stagingKey = buildAnalysisStagingKey({ jobId: input.jobId, extension });
    const bucket = await this.resolveBucket(input.tenantId);

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
  }): Promise<Buffer> {
    await this.ensureReady();

    const extension = sanitizeFileExtension({
      extension: input.originalFileName?.split('.').pop(),
      mimeType: input.mimeType ?? 'application/pdf',
    });

    const stagingKey = buildAnalysisStagingKey({ jobId: input.jobId, extension });
    const bucket = await this.resolveBucket(input.tenantId);

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
  }): Promise<void> {
    await this.ensureReady();

    const extension = sanitizeFileExtension({
      extension: input.originalFileName?.split('.').pop(),
      mimeType: input.mimeType ?? 'application/pdf',
    });

    const stagingKey = buildAnalysisStagingKey({ jobId: input.jobId, extension });
    const bucket = await this.resolveBucket(input.tenantId);

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
