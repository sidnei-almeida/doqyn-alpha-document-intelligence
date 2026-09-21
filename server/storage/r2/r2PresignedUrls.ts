import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { TenantStorageScope } from '../../tenancy/resolveTenantStorageScope.js';
import { getPresignedUploadTtlSeconds } from '../presignedUploadConfig.js';
import type { StorageConfig } from '../storageConfig.js';
import { buildAnalysisStagingKey, sanitizeFileExtension } from '../storageKeys.js';
import { createR2StorageProvider } from './r2StorageProvider.js';
import { ServiceError } from '../../utils/serviceErrors.js';

export type StagingPresignedPutInput = {
  tenantId: string;
  jobId: string;
  mimeType: string;
  originalFileName: string;
  /** Já conferido contra o limite de upload; vira header assinado da URL. */
  sizeBytes: number;
  storageScope?: TenantStorageScope;
};

export type StagingPresignedPutResult = {
  uploadUrl: string;
  stagingKey: string;
  bucket: string;
  expiresAt: string;
  expiresInSeconds: number;
  method: 'PUT';
  requiredHeaders: {
    'Content-Type': string;
  };
};

export async function createStagingPresignedPutUrl(
  config: StorageConfig,
  input: StagingPresignedPutInput,
): Promise<StagingPresignedPutResult> {
  if (!config.r2) {
    throw new ServiceError('Storage R2 não configurado.', 'STORAGE_NOT_CONFIGURED', 503);
  }

  const extension = sanitizeFileExtension({
    extension: input.originalFileName.split('.').pop(),
    mimeType: input.mimeType,
  });

  const stagingKey = buildAnalysisStagingKey({
    jobId: input.jobId,
    extension,
    basePrefix: input.storageScope?.basePrefix,
  });

  const provider = createR2StorageProvider(config);
  await provider.ensureReady();

  const bucket = await provider.resolveStagingBucket(input.storageScope, input.tenantId);
  const contentType = input.mimeType?.trim() || 'application/pdf';
  const expiresInSeconds = getPresignedUploadTtlSeconds();

  // O tamanho declarado entra na assinatura. Sem isso a API conferia o `sizeBytes` informado pelo
  // cliente contra o limite, mas a URL aceitava qualquer corpo: declarava-se 1 KB e subia-se 5 GB
  // direto ao R2. Com `content-length` em SignedHeaders, corpo de outro tamanho não bate a
  // assinatura. O navegador preenche o header sozinho com o tamanho do `File`.
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: stagingKey,
    ContentType: contentType,
    ContentLength: input.sizeBytes,
  });

  const uploadUrl = await getSignedUrl(provider.getRuntimeClient(), command, {
    expiresIn: expiresInSeconds,
    signableHeaders: new Set(['content-length']),
  });

  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

  return {
    uploadUrl,
    stagingKey,
    bucket,
    expiresAt,
    expiresInSeconds,
    method: 'PUT',
    requiredHeaders: {
      'Content-Type': contentType,
    },
  };
}
