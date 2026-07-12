import { lookup } from 'mime-types';
import type { TenantStorageScope } from '../../tenancy/resolveTenantStorageScope.js';
import { createAnalysisJobId } from '../analysis/analysisJobService.js';
import { getStorageConfig } from '../../storage/storageConfig.js';
import { isPresignedUploadEnabled } from '../../storage/presignedUploadConfig.js';
import { createStagingPresignedPutUrl } from '../../storage/r2/r2PresignedUrls.js';
import { ServiceError } from '../../utils/serviceErrors.js';
import { AI_ERROR_MESSAGES } from '../../ai/constants.js';

const PDF_MIME = 'application/pdf';

function resolveMimeType(fileName: string, mimeType?: string): string {
  const trimmed = mimeType?.trim();
  if (trimmed) return trimmed;
  return lookup(fileName) || PDF_MIME;
}

function assertPdfUpload(fileName: string, mimeType: string): void {
  const lower = fileName.toLowerCase();
  if (!lower.endsWith('.pdf') && mimeType !== PDF_MIME) {
    throw new ServiceError(AI_ERROR_MESSAGES.pdfOnly, 'PDF_ONLY', 400);
  }
}

export type IssueAnalysisStagingUploadUrlInput = {
  tenantId: string;
  ownerUserId: string;
  originalFileName: string;
  mimeType?: string;
  sizeBytes: number;
  storageScope?: TenantStorageScope;
};

export type IssueAnalysisStagingUploadUrlResult = {
  jobId: string;
  stagingKey: string;
  uploadUrl: string;
  expiresAt: string;
  expiresInSeconds: number;
  method: 'PUT';
  requiredHeaders: {
    'Content-Type': string;
  };
};

export function assertPresignedUploadAvailable(): void {
  if (!isPresignedUploadEnabled()) {
    throw new ServiceError(
      'Upload presigned indisponível neste ambiente.',
      'PRESIGNED_UPLOAD_DISABLED',
      503,
    );
  }
}

export async function issueAnalysisStagingUploadUrl(
  input: IssueAnalysisStagingUploadUrlInput,
): Promise<IssueAnalysisStagingUploadUrlResult> {
  assertPresignedUploadAvailable();

  const originalFileName = input.originalFileName?.trim() || 'documento.pdf';
  const mimeType = resolveMimeType(originalFileName, input.mimeType);
  assertPdfUpload(originalFileName, mimeType);

  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    throw new ServiceError(AI_ERROR_MESSAGES.emptyFile, 'EMPTY_FILE', 400);
  }

  const storageConfig = getStorageConfig();
  if (input.sizeBytes > storageConfig.maxUploadBytes) {
    throw new ServiceError(
      `Arquivo excede o limite de ${Math.floor(storageConfig.maxUploadBytes / (1024 * 1024))} MB.`,
      'FILE_TOO_LARGE',
      413,
    );
  }

  const jobId = createAnalysisJobId();
  const presigned = await createStagingPresignedPutUrl(storageConfig, {
    tenantId: input.tenantId,
    jobId,
    mimeType,
    originalFileName,
    storageScope: input.storageScope,
  });

  return {
    jobId,
    stagingKey: presigned.stagingKey,
    uploadUrl: presigned.uploadUrl,
    expiresAt: presigned.expiresAt,
    expiresInSeconds: presigned.expiresInSeconds,
    method: presigned.method,
    requiredHeaders: presigned.requiredHeaders,
  };
}
