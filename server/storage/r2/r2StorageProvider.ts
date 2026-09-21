import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
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
import { mirrorObject, readMirroredObject } from '../mirror/mirrorStorage.js';
import { logger } from '../../utils/logger.js';
import { isStorageMirrorEnabled } from '../mirror/mirrorConfig.js';

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

/**
 * `CopySource` do S3 é `bucket/chave` com a chave codificada em URL, segmento a segmento: a barra
 * separa pastas e não pode virar `%2F`, mas espaço e acento no nome do arquivo precisam ser escapados.
 */
export function buildR2CopySource(bucket: string, key: string): string {
  return `${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

export type StagingPromotionPlan = {
  bucket: string;
  stagingKey: string;
  destinationKey: string;
  sizeBytes: number;
};

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

  getRuntimeClient(): S3Client {
    return this.runtimeClient;
  }

  async resolveStagingBucket(
    storageScope: TenantStorageScope | undefined,
    tenantId: string,
  ): Promise<string> {
    if (storageScope) {
      return this.resolveBucketFromScope(storageScope);
    }
    return this.resolveBucket(tenantId);
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
    const { bucket, corsPolicyHash } = await this.ensureBucketForScopeFn({
      bucketMode: scope.bucketMode,
      bucketName: scope.bucketName,
      tenantId: scope.tenantId,
      config: this.r2,
    });

    if (scope.bucketMode === 'per_tenant') {
      await markTenantBucketReady(scope.tenantId, bucket, corsPolicyHash).catch(() => undefined);
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

    try {
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
    } catch (error) {
      /**
       * O R2 não respondeu — tenta o espelho antes de desistir.
       *
       * É aqui que o espelho paga por si: quem chegou neste ponto já passou pela checagem de
       * tenant e de permissão do documento, então servir do espelho não abre porta nenhuma que o
       * caminho normal não abrisse. Uma camada acima seria diferente, e é por isso que este
       * fallback mora dentro do provedor.
       *
       * Sem espelho configurado, ou com o objeto ausente nele, o erro original sobe como sempre —
       * a falha não pode virar "documento não encontrado", que é diagnóstico errado.
       */
      const mirrored = await readMirroredObject(bucket, storageKey);
      if (!mirrored) throw error;

      logger.warn('documento servido pelo espelho: leitura no R2 falhou', {
        tenantId,
        storageKey,
        reason: error instanceof Error ? error.message : 'unknown',
      });

      return {
        buffer: mirrored,
        storageKey,
        sizeBytes: mirrored.length,
        bucket,
      };
    }
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

    await this.mirrorDerived(bucket, storageKey, input.buffer, 'application/pdf', input.tenantId);

    return {
      storageKey,
      sizeBytes: input.buffer.length,
      provider: 'r2',
      bucket,
      etag: result.ETag ?? undefined,
      contentType: 'application/pdf',
    };
  }

  /**
   * Espelha um derivado (preview, miniatura) sem deixar a falha subir.
   *
   * Diferente da versão do documento, preview é dado derivado: se o espelho perder um, ele se
   * refaz a partir do original. Por isso aqui não há fila nem retry — derrubar a geração do
   * preview, que é o que o usuário está esperando na tela, para salvar uma cópia que se reconstrói
   * seria trocar o certo pelo duvidoso.
   */
  private async mirrorDerived(
    bucket: string,
    objectKey: string,
    buffer: Buffer,
    contentType: string,
    tenantId: string,
  ): Promise<void> {
    if (!isStorageMirrorEnabled()) return;

    await mirrorObject({
      bucket,
      objectKey,
      body: buffer,
      contentType,
      tenantId,
      versionId: objectKey,
    }).catch((error: unknown) => {
      logger.warn('derivado não espelhado', {
        tenantId,
        bucket,
        objectKey,
        reason: error instanceof Error ? error.message : 'unknown',
      });
    });
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

    await this.mirrorDerived(
      bucket,
      input.objectKey,
      input.buffer,
      input.contentType,
      input.tenantId,
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

  /**
   * O que a confirmação precisa para gravar a versão apontando para o provisório.
   *
   * Um `HEAD` só: confirma que o arquivo existe e tem o tamanho analisado, e devolve as duas chaves
   * — a do provisório, onde a versão nasce, e a definitiva, para onde a fila de promoção copia.
   */
  async planStagingPromotion(input: {
    tenantId: string;
    jobId: string;
    documentId: string;
    versionId: string;
    storageFileName: string;
    mimeType?: string;
    originalFileName?: string;
    storageScope?: TenantStorageScope;
  }): Promise<StagingPromotionPlan> {
    const head = await this.headStagingFile(input);

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
    const destinationKey = buildDocumentVersionObjectKey({
      documentId: input.documentId,
      versionId: input.versionId,
      storageFileName: input.storageFileName,
      keyPrefix: scope?.keyPrefix ?? this.r2.keyPrefix,
      basePrefix: scope?.basePrefix,
    });
    const bucket = await this.resolveStagingBucket(scope, input.tenantId);

    return { bucket, stagingKey, destinationKey, sizeBytes: head.sizeBytes };
  }

  /** Cópia dentro do próprio R2: o arquivo não passa pela VPS. */
  async copyObjectWithinBucket(input: {
    bucket: string;
    sourceKey: string;
    destinationKey: string;
    contentType?: string;
  }): Promise<{ etag?: string }> {
    await this.ensureReady();

    const result = await this.runtimeClient.send(
      new CopyObjectCommand({
        Bucket: input.bucket,
        Key: input.destinationKey,
        CopySource: buildR2CopySource(input.bucket, input.sourceKey),
        ...(input.contentType
          ? { ContentType: input.contentType, MetadataDirective: 'REPLACE' as const }
          : {}),
      }),
    );

    return { etag: result.CopyObjectResult?.ETag ?? undefined };
  }

  async headStagingFile(input: {
    tenantId: string;
    jobId: string;
    mimeType?: string;
    originalFileName?: string;
    storageScope?: TenantStorageScope;
  }): Promise<{ sizeBytes: number; contentType?: string; etag?: string }> {
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

    try {
      const result = await this.runtimeClient.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: stagingKey,
        }),
      );

      const sizeBytes = Number(result.ContentLength ?? 0);
      if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
        throw new ServiceError(
          'Arquivo de staging vazio ou ausente.',
          'STAGING_FILE_NOT_FOUND',
          400,
        );
      }

      return {
        sizeBytes,
        contentType: result.ContentType,
        etag: result.ETag ?? undefined,
      };
    } catch (error) {
      const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
      const status =
        error && typeof error === 'object' && '$metadata' in error
          ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
          : undefined;
      if (name === 'NotFound' || status === 404) {
        throw new ServiceError(
          'Arquivo ainda não foi enviado ao storage. Conclua o upload antes de analisar.',
          'STAGING_FILE_NOT_FOUND',
          400,
        );
      }
      throw error;
    }
  }

  async hashStagingFile(input: {
    tenantId: string;
    jobId: string;
    mimeType?: string;
    originalFileName?: string;
    storageScope?: TenantStorageScope;
  }): Promise<string> {
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

    const hash = createHash('sha256');
    if (!result.Body) {
      throw new ServiceError('Arquivo de staging vazio.', 'STAGING_FILE_NOT_FOUND', 400);
    }

    for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
      hash.update(Buffer.from(chunk));
    }

    return hash.digest('hex');
  }
}

export function createR2StorageProvider(
  config: StorageConfig,
  deps?: R2StorageProviderDeps,
): R2StorageProvider {
  return new R2StorageProvider(config, deps);
}
