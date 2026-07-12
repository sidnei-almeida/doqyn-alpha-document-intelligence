import type { TenantStorageScope } from '../tenancy/resolveTenantStorageScope.js';
import { getStorageProvider } from './getStorageProvider.js';
import { isStagingCapableProvider } from './storageProvider.js';
import { isR2StorageEnabled, getStorageConfig } from './storageConfig.js';
import { createR2StorageProvider } from './r2/r2StorageProvider.js';
import { ServiceError } from '../utils/serviceErrors.js';

export type AnalysisStagingHeadResult = {
  sizeBytes: number;
  contentType?: string;
  etag?: string;
};

async function getR2Provider() {
  const config = getStorageConfig();
  if (!isR2StorageEnabled() || !config.r2) {
    throw new ServiceError('Storage R2 não configurado.', 'STORAGE_NOT_CONFIGURED', 503);
  }
  return createR2StorageProvider(config);
}

export async function headAnalysisStaging(input: {
  tenantId: string;
  jobId: string;
  mimeType?: string;
  originalFileName?: string;
  storageScope?: TenantStorageScope;
}): Promise<AnalysisStagingHeadResult> {
  const provider = await getR2Provider();
  return provider.headStagingFile(input);
}

export async function hashAnalysisStaging(input: {
  tenantId: string;
  jobId: string;
  mimeType?: string;
  originalFileName?: string;
  storageScope?: TenantStorageScope;
}): Promise<string> {
  const provider = await getR2Provider();
  return provider.hashStagingFile(input);
}

export async function assertAndHashAnalysisStaging(input: {
  tenantId: string;
  jobId: string;
  originalFileName: string;
  mimeType: string;
  expectedSizeBytes: number;
  storageScope?: TenantStorageScope;
}): Promise<{ fileHash: string; sizeBytes: number }> {
  const head = await headAnalysisStaging({
    tenantId: input.tenantId,
    jobId: input.jobId,
    mimeType: input.mimeType,
    originalFileName: input.originalFileName,
    storageScope: input.storageScope,
  });

  if (head.sizeBytes !== input.expectedSizeBytes) {
    throw new ServiceError(
      'Tamanho do arquivo no storage não confere com o informado.',
      'STAGING_SIZE_MISMATCH',
      400,
    );
  }

  const fileHash = await hashAnalysisStaging({
    tenantId: input.tenantId,
    jobId: input.jobId,
    mimeType: input.mimeType,
    originalFileName: input.originalFileName,
    storageScope: input.storageScope,
  });

  return { fileHash, sizeBytes: head.sizeBytes };
}

/** Carrega staging via provider ativo (local ou R2). */
export async function loadAnalysisStagingBuffer(input: {
  tenantId: string;
  ownerUserId: string;
  jobId: string;
  expectedSha256: string;
  mimeType?: string;
  originalFileName?: string;
  storageScope?: TenantStorageScope;
}): Promise<Buffer> {
  const provider = getStorageProvider();
  if (!provider || !isStagingCapableProvider(provider)) {
    throw new ServiceError('Storage não configurado.', 'STORAGE_NOT_CONFIGURED', 503);
  }

  return provider.loadStagingFile({
    tenantId: input.tenantId,
    jobId: input.jobId,
    mimeType: input.mimeType,
    originalFileName: input.originalFileName,
    ownerUserId: input.ownerUserId,
    storageScope: input.storageScope,
  }).then(async (buffer) => {
    const { createHash } = await import('node:crypto');
    const hash = createHash('sha256').update(buffer).digest('hex');
    if (hash !== input.expectedSha256) {
      throw new ServiceError(
        'Integridade do arquivo não confere. Refaça a análise.',
        'STAGING_HASH_MISMATCH',
        400,
      );
    }
    return buffer;
  });
}
