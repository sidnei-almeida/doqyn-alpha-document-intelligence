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

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: stagingKey,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(provider.getRuntimeClient(), command, {
    expiresIn: expiresInSeconds,
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
