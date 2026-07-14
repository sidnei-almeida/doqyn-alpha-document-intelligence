import type { MetadataExtractionResult, ProcessingLogItem } from '../../ai/types/documentAi.types.js';
import { mapExtractedFieldSource } from '../../ai/utils/mapMetadataSource.js';
import type {
  MongoDocumentVersion,
  MongoVersionMetadataField,
} from '../../db/types.js';
import type { TenantStorageScope } from '../../tenancy/resolveTenantStorageScope.js';
import {
  deleteAnalysisStaging,
  isStorageConfigured,
  loadAnalysisStaging,
} from '../../storage/index.js';
import { storeUploadedDocumentFile } from '../documentFileService.js';
import { ServiceError } from '../../utils/serviceErrors.js';
import {
  dedupeMetadataRecord,
  resolveMetadataLabel,
} from '../../../shared/metadataKeyNormalize.js';

export class ConfirmAnalysisError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(message: string, code: string, statusCode = 400) {
    super(message);
    this.name = 'ConfirmAnalysisError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function isConfirmAnalysisError(error: unknown): error is ConfirmAnalysisError {
  return error instanceof ConfirmAnalysisError;
}

export type ConfirmLogLike = {
  title: string;
  status: ProcessingLogItem['status'] | string;
};

export function buildStoragePlaceholders(): MongoDocumentVersion['storage'] {
  return {
    primary: {
      provider: 'aws_s3',
      status: 'pending',
      objectKey: null,
      bucketAlias: null,
      storedAt: null,
    },
    backup: {
      provider: 'cloudflare_r2',
      status: 'pending',
      objectKey: null,
      bucketAlias: null,
      storedAt: null,
    },
  };
}

export async function persistConfirmedVersionFile(input: {
  tenantId: string;
  ownerUserId: string;
  documentId: string;
  versionId: string;
  jobId?: string;
  fileHash: string;
  fileSizeBytes: number;
  originalFileName: string;
  storageFileName: string;
  storageScope: TenantStorageScope;
  mimeType?: string;
}): Promise<{ storage: MongoDocumentVersion['storage']; buffer: Buffer | null }> {
  const mimeType = input.mimeType?.trim() || 'application/pdf';

  if (!isStorageConfigured()) {
    return { storage: buildStoragePlaceholders(), buffer: null };
  }

  if (!input.jobId?.trim()) {
    throw new ConfirmAnalysisError(
      'Identificador da análise ausente. Refaça a análise do documento.',
      'STAGING_JOB_REQUIRED',
      400,
    );
  }

  const buffer = await loadAnalysisStaging({
    tenantId: input.tenantId,
    ownerUserId: input.ownerUserId,
    jobId: input.jobId,
    expectedSha256: input.fileHash,
    mimeType,
    originalFileName: input.originalFileName,
    storageScope: input.storageScope,
  }).catch((error: unknown) => {
    if (error instanceof ServiceError) {
      throw new ConfirmAnalysisError(error.message, error.code, error.statusCode);
    }
    throw error;
  });

  if (buffer.length !== input.fileSizeBytes) {
    throw new ConfirmAnalysisError(
      'Tamanho do arquivo não confere. Refaça a análise.',
      'STAGING_SIZE_MISMATCH',
      400,
    );
  }

  const storage = await storeUploadedDocumentFile({
    tenantId: input.tenantId,
    documentId: input.documentId,
    versionId: input.versionId,
    buffer,
    mimeType,
    originalFileName: input.originalFileName,
    storageFileName: input.storageFileName,
    storageScope: input.storageScope,
  });

  await deleteAnalysisStaging({
    tenantId: input.tenantId,
    ownerUserId: input.ownerUserId,
    jobId: input.jobId,
    mimeType,
    originalFileName: input.originalFileName,
    storageScope: input.storageScope,
  });

  return { storage, buffer };
}

export function mapVersionMetadata(
  metadata: MetadataExtractionResult['metadata'],
): Record<string, MongoVersionMetadataField> {
  const mapped: Record<string, MongoVersionMetadataField> = {};

  for (const [key, field] of Object.entries(metadata)) {
    mapped[key] = {
      label: field.label,
      value: field.value,
      normalizedValue: field.normalizedValue ?? field.value,
      confidence: field.confidence,
      source: mapExtractedFieldSource(field.source),
      page: field.evidence?.pageNumber,
      ...(field.currency ? { currency: field.currency } : {}),
      ...(field.evidence ? { evidence: field.evidence } : {}),
    };
  }

  // Une chaves/labels equivalentes ("Parte Reveladora" ≈ parte_reveladora) e
  // grava labels canônicos para não reaparecer duplicata na próxima versão.
  return Object.fromEntries(
    Object.entries(dedupeMetadataRecord(mapped)).map(([key, field]) => [
      key,
      {
        ...field,
        label: resolveMetadataLabel(key, field.label),
      },
    ]),
  );
}

export function buildDocumentTitle(
  className: string,
  metadata: Record<string, MongoVersionMetadataField>,
): string {
  const reveladora =
    metadata.parte_reveladora?.normalizedValue ?? metadata.parte_reveladora?.value;
  const receptora =
    metadata.parte_receptora?.normalizedValue ?? metadata.parte_receptora?.value;
  const fornecedor = metadata.fornecedor?.normalizedValue ?? metadata.fornecedor?.value;
  const numeroNota = metadata.numero_nota?.value;

  if (reveladora && receptora) {
    return `${className} — ${reveladora} e ${receptora}`;
  }

  const party = receptora ?? reveladora ?? fornecedor ?? numeroNota;
  if (party) {
    return `${className} — ${party}`;
  }

  return className;
}

export function buildProcessingSteps(
  logs: ConfirmLogLike[],
  persistedAt: Date,
  finalStep: { key: string; label: string },
) {
  const baseSteps = logs.map((log) => ({
    key: log.title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, ''),
    label: log.title,
    status: log.status === 'error' ? ('error' as const) : ('done' as const),
    createdAt: persistedAt,
  }));

  return [
    ...baseSteps,
    {
      key: finalStep.key,
      label: finalStep.label,
      status: 'done' as const,
      createdAt: persistedAt,
    },
  ];
}

export function requireConfirmClassification(input: {
  classId: string | null;
  requiresReview: boolean;
  extractionRequiresReview: boolean;
  manualReviewConfirmed?: boolean;
}): string {
  if (!input.classId) {
    throw new ConfirmAnalysisError(
      'Classificação inválida. Não é possível confirmar sem uma classe identificada.',
      'INVALID_CLASSIFICATION',
      400,
    );
  }

  const needsReview = input.requiresReview || input.extractionRequiresReview;
  if (needsReview && !input.manualReviewConfirmed) {
    throw new ConfirmAnalysisError(
      'Este documento requer revisão manual antes de ser confirmado.',
      'REQUIRES_REVIEW',
      409,
    );
  }

  return input.classId;
}

export function assertAiSuggestedNamePresent(input: {
  namingMode: string;
  finalFileName?: string;
  aiSuggestedFileName?: string;
}): void {
  if (
    input.namingMode === 'ai_suggested' &&
    !input.finalFileName?.trim() &&
    !input.aiSuggestedFileName?.trim()
  ) {
    throw new ConfirmAnalysisError(
      'Nome sugerido ausente. Não é possível salvar o documento.',
      'MISSING_RECOMMENDED_NAME',
      400,
    );
  }
}

export { projectDocumentSearchMeta, parseMetadataDate } from './projectSearchMeta.js';
