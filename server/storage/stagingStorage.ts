import { createHash } from 'node:crypto';
import type { TenantStorageScope } from '../tenancy/resolveTenantStorageScope.js';
import { getStorageProvider } from './getStorageProvider.js';
import { isStagingCapableProvider } from './storageProvider.js';
import { ServiceError } from '../utils/serviceErrors.js';

export type StoreAnalysisStagingInput = {
  tenantId: string;
  ownerUserId: string;
  jobId: string;
  buffer: Buffer;
  mimeType: string;
  originalFileName?: string;
  storageScope?: TenantStorageScope;
};

export async function storeAnalysisStaging(input: StoreAnalysisStagingInput): Promise<string> {
  const provider = getStorageProvider();
  if (!provider || !isStagingCapableProvider(provider)) {
    return '';
  }

  return provider.storeStagingFile({
    tenantId: input.tenantId,
    jobId: input.jobId,
    buffer: input.buffer,
    mimeType: input.mimeType,
    originalFileName: input.originalFileName,
    ownerUserId: input.ownerUserId,
    storageScope: input.storageScope,
  });
}

export async function loadAnalysisStaging(input: {
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
    throw new ServiceError(
      'Storage não configurado.',
      'STORAGE_NOT_CONFIGURED',
      503,
    );
  }

  let buffer: Buffer;
  try {
    buffer = await provider.loadStagingFile({
      tenantId: input.tenantId,
      jobId: input.jobId,
      mimeType: input.mimeType,
      originalFileName: input.originalFileName,
      ownerUserId: input.ownerUserId,
      storageScope: input.storageScope,
    });
  } catch (error) {
    if (error instanceof ServiceError && error.code === 'STAGING_FILE_NOT_FOUND') {
      throw error;
    }
    throw new ServiceError(
      'Arquivo original não encontrado. Refaça a análise e confirme novamente.',
      'STAGING_FILE_NOT_FOUND',
      400,
    );
  }

  const hash = createHash('sha256').update(buffer).digest('hex');
  if (hash !== input.expectedSha256) {
    throw new ServiceError(
      'Integridade do arquivo não confere. Refaça a análise.',
      'STAGING_HASH_MISMATCH',
      400,
    );
  }

  return buffer;
}

export async function deleteAnalysisStaging(input: {
  tenantId: string;
  ownerUserId: string;
  jobId: string;
  mimeType?: string;
  originalFileName?: string;
  storageScope?: TenantStorageScope;
}): Promise<void> {
  const provider = getStorageProvider();
  if (!provider || !isStagingCapableProvider(provider)) {
    return;
  }

  await provider.deleteStagingFile({
    tenantId: input.tenantId,
    jobId: input.jobId,
    mimeType: input.mimeType,
    originalFileName: input.originalFileName,
    ownerUserId: input.ownerUserId,
    storageScope: input.storageScope,
  });
}
