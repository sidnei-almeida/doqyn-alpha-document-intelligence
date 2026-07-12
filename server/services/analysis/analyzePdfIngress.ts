import { lookup } from 'mime-types';
import type { TenantStorageScope } from '../../tenancy/resolveTenantStorageScope.js';
import {
  assertAndHashAnalysisStaging,
  loadAnalysisStagingBuffer,
} from '../../storage/analysisStagingObject.js';
import { getStorageConfig } from '../../storage/storageConfig.js';
import { isPresignedUploadEnabled } from '../../storage/presignedUploadConfig.js';
import { AI_ERROR_MESSAGES } from '../../ai/constants.js';
import { ServiceError } from '../../utils/serviceErrors.js';
import type { ParsedAnalyzePdfRequest } from '../../utils/parseAnalyzePdfRequest.js';

const PDF_MIME = 'application/pdf';

export type ResolvedAnalyzePdfIngress = {
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  jobId?: string;
  fromStaging: boolean;
  buffer?: Buffer;
  fileHash?: string;
};

function resolveFileName(stagingFileName: string | undefined, fallback = 'documento.pdf'): string {
  return stagingFileName?.trim() || fallback;
}

function resolveMimeType(fileName: string, mimeType?: string): string {
  if (mimeType?.trim()) return mimeType.trim();
  return lookup(fileName) || PDF_MIME;
}

export async function resolveAnalyzePdfIngress(
  parsed: ParsedAnalyzePdfRequest,
  input: {
    tenantId: string;
    ownerUserId: string;
    storageScope?: TenantStorageScope;
    loadBuffer?: boolean;
  },
): Promise<ResolvedAnalyzePdfIngress> {
  if (parsed.mode === 'multipart') {
    const { file } = parsed;
    if (file.size === 0) {
      throw new ServiceError(AI_ERROR_MESSAGES.emptyFile, 'EMPTY_FILE', 400);
    }

    const storageConfig = getStorageConfig();
    if (file.size > storageConfig.maxUploadBytes) {
      throw new ServiceError(
        `Arquivo excede o limite de ${Math.floor(storageConfig.maxUploadBytes / (1024 * 1024))} MB.`,
        'FILE_TOO_LARGE',
        413,
      );
    }

    return {
      originalFileName: file.filename,
      mimeType: file.mimeType,
      fileSize: file.size,
      fromStaging: false,
      buffer: input.loadBuffer ? file.buffer : undefined,
    };
  }

  if (!isPresignedUploadEnabled()) {
    throw new ServiceError(
      'Upload presigned indisponível. Envie o arquivo via multipart.',
      'PRESIGNED_UPLOAD_DISABLED',
      400,
    );
  }

  const originalFileName = resolveFileName(parsed.staging.originalFileName);
  const mimeType = resolveMimeType(originalFileName, parsed.staging.mimeType);
  const fileSize = parsed.staging.sizeBytes;

  const storageConfig = getStorageConfig();
  if (fileSize > storageConfig.maxUploadBytes) {
    throw new ServiceError(
      `Arquivo excede o limite de ${Math.floor(storageConfig.maxUploadBytes / (1024 * 1024))} MB.`,
      'FILE_TOO_LARGE',
      413,
    );
  }

  const { fileHash } = await assertAndHashAnalysisStaging({
    tenantId: input.tenantId,
    jobId: parsed.staging.jobId,
    originalFileName,
    mimeType,
    expectedSizeBytes: fileSize,
    storageScope: input.storageScope,
  });

  let buffer: Buffer | undefined;
  if (input.loadBuffer) {
    buffer = await loadAnalysisStagingBuffer({
      tenantId: input.tenantId,
      ownerUserId: input.ownerUserId,
      jobId: parsed.staging.jobId,
      expectedSha256: fileHash,
      mimeType,
      originalFileName,
      storageScope: input.storageScope,
    });
  }

  return {
    originalFileName,
    mimeType,
    fileSize,
    jobId: parsed.staging.jobId,
    fromStaging: true,
    buffer,
    fileHash,
  };
}

export function readDocumentIdFromIngress(
  parsed: ParsedAnalyzePdfRequest,
): string | undefined {
  if (parsed.mode === 'staging') {
    return parsed.staging.documentId?.trim() || undefined;
  }
  return parsed.fields.documentId?.trim() || undefined;
}
