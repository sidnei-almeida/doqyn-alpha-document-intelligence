import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getStorageConfig, isLocalStorageEnabled } from './storageConfig.js';
import { createLocalStorageProvider } from './localStorageProvider.js';
import {
  buildAnalysisStagingKey,
  resolveStorageAbsolutePath,
  sanitizeFileExtension,
} from './storageKeys.js';
import { ServiceError } from '../utils/serviceErrors.js';

export type StoreAnalysisStagingInput = {
  tenantId: string;
  ownerUserId: string;
  jobId: string;
  buffer: Buffer;
  mimeType: string;
  originalFileName?: string;
};

export async function storeAnalysisStaging(input: StoreAnalysisStagingInput): Promise<string> {
  if (!isLocalStorageEnabled()) {
    return '';
  }

  const config = getStorageConfig();
  const provider = createLocalStorageProvider(config);
  await provider.ensureReady();

  if (input.buffer.length > config.maxUploadBytes) {
    throw new ServiceError(
      `Arquivo excede o limite de ${Math.floor(config.maxUploadBytes / (1024 * 1024))} MB.`,
      'FILE_TOO_LARGE',
      413,
    );
  }

  const extension = sanitizeFileExtension({
    extension: input.originalFileName?.split('.').pop(),
    mimeType: input.mimeType,
  });

  const stagingKey = buildAnalysisStagingKey({
    tenantId: input.tenantId,
    ownerUserId: input.ownerUserId,
    jobId: input.jobId,
    extension,
  });

  const absolutePath = resolveStorageAbsolutePath(config.localRoot, stagingKey);
  await mkdir(path.dirname(absolutePath), { recursive: true });

  try {
    await writeFile(absolutePath, input.buffer);
  } catch (error) {
    await rm(absolutePath, { force: true }).catch(() => undefined);
    throw error;
  }

  return stagingKey;
}

export async function loadAnalysisStaging(input: {
  tenantId: string;
  ownerUserId: string;
  jobId: string;
  expectedSha256: string;
  mimeType?: string;
  originalFileName?: string;
}): Promise<Buffer> {
  if (!isLocalStorageEnabled()) {
    throw new ServiceError(
      'Storage local não configurado.',
      'STORAGE_NOT_CONFIGURED',
      503,
    );
  }

  const config = getStorageConfig();
  const provider = createLocalStorageProvider(config);
  await provider.ensureReady();

  const extension = sanitizeFileExtension({
    extension: input.originalFileName?.split('.').pop(),
    mimeType: input.mimeType ?? 'application/pdf',
  });

  const stagingKey = buildAnalysisStagingKey({
    tenantId: input.tenantId,
    ownerUserId: input.ownerUserId,
    jobId: input.jobId,
    extension,
  });

  const absolutePath = resolveStorageAbsolutePath(config.localRoot, stagingKey);

  let buffer: Buffer;
  try {
    buffer = await readFile(absolutePath);
  } catch {
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
}): Promise<void> {
  if (!isLocalStorageEnabled()) {
    return;
  }

  const config = getStorageConfig();
  const extension = sanitizeFileExtension({
    extension: input.originalFileName?.split('.').pop(),
    mimeType: input.mimeType ?? 'application/pdf',
  });

  const stagingKey = buildAnalysisStagingKey({
    tenantId: input.tenantId,
    ownerUserId: input.ownerUserId,
    jobId: input.jobId,
    extension,
  });

  const absolutePath = resolveStorageAbsolutePath(config.localRoot, stagingKey);
  await rm(absolutePath, { force: true }).catch(() => undefined);
}
