import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { ExtractedMetadataField, MetadataExtractionResult } from '../ai/types/documentAi.types.js';
import { canConfirmDocuments } from '../auth/permissions.js';
import { resolveCategoryAccessGroupIds } from './documentAccessRulesService.js';
import type { DocumentRequestContext } from '../tenancy/documentRequestContext.js';
import type { TenantStorageScope } from '../tenancy/resolveTenantStorageScope.js';
import {
  buildDocumentOwnershipFilter,
  withTenantFieldsFromContext,
} from '../tenancy/tenantQuery.js';
import type {
  MongoDocument,
  MongoDocumentVersion,
  MongoMetadataIndexEntry,
  MongoProcessingJob,
  MongoRuleField,
  MongoVersionMetadataField,
} from '../db/types.js';
import type { AuthUser } from '../auth/types.js';
import { buildDocumentAuditContext } from '../audit/buildDocumentAuditContext.js';
import { buildFilenameUpdatedAuditEvent } from '../audit/buildFilenameUpdatedAuditEvent.js';
import { buildAuditChangeSet } from '../audit/documentAuditHelpers.js';
import { createDocumentAuditLogs } from '../audit/documentAuditLogService.js';
import { buildDocumentNameSnapshot } from '../audit/documentNameSnapshot.js';
import type { DocumentAuditEventInput } from '../audit/documentAuditTypes.js';
import {
  diagnoseClassAndRuleLookup,
  getMongoClassAndRule,
} from './documentRulesService.js';
import { sanitizeAuditMetadata } from '../utils/sanitizeAuditMetadata.js';
import { getMongoDatabaseName } from '../db/database.js';
import { logger } from '../utils/logger.js';
import {
  deleteAnalysisStaging,
  getStorageProvider,
  isStorageConfigured,
  loadAnalysisStaging,
} from '../storage/index.js';
import { storeUploadedDocumentFile } from './documentFileService.js';
import { generateDocumentPreviewForVersion } from './documentPreviewService.js';
import { ServiceError } from '../utils/serviceErrors.js';
import {
  resolveStorageFileNames,
  type NamingMode,
} from '../utils/resolveStorageFileNames.js';

const evidenceSchema = z.object({
  pageNumber: z.number().optional(),
  snippet: z.string(),
});

const classificationSchema = z.object({
  classId: z.string().nullable(),
  className: z.string().nullable(),
  confidence: z.number(),
  requiresReview: z.boolean(),
  reason: z.string(),
  evidence: z.array(evidenceSchema).optional().default([]),
});

const metadataFieldSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number(), z.null()]),
  normalizedValue: z.union([z.string(), z.number(), z.null()]).optional(),
  confidence: z.number(),
  source: z.enum(['document_text', 'no_ai']).optional().default('document_text'),
  evidence: evidenceSchema.optional(),
  currency: z.string().optional(),
});

const extractionSchema = z.object({
  documentType: z.string().nullable(),
  version: z.string(),
  metadata: z.record(metadataFieldSchema),
  missingFields: z.array(z.string()),
  requiresReview: z.boolean(),
  reviewReasons: z.array(z.string()),
});

export const confirmAnalysisSchema = z.object({
  jobId: z.string().optional(),
  originalFileName: z.string().min(1),
  recommendedFileName: z.string().min(1).optional(),
  aiSuggestedFileName: z.string().min(1).optional(),
  namingMode: z.enum(['ai_suggested', 'original', 'manual']).optional().default('ai_suggested'),
  finalFileName: z.string().min(1).optional(),
  selectedFileName: z.string().min(1).optional(),
  fileHash: z.string().regex(/^[a-f0-9]{64}$/, 'Hash SHA256 inválido'),
  fileSizeBytes: z.number().int().nonnegative(),
  textExtraction: z.object({
    status: z.enum(['completed', 'failed']),
    pageCount: z.number().optional(),
    charCount: z.number(),
    truncated: z.boolean(),
  }),
  classification: classificationSchema,
  extraction: extractionSchema,
  logs: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      status: z.enum(['done', 'active', 'pending', 'error']),
    }),
  ),
  manualReviewConfirmed: z.boolean().optional().default(false),
});

export type ConfirmAnalysisInput = z.infer<typeof confirmAnalysisSchema>;

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

function buildMetadataIndex(
  metadata: Record<string, ExtractedMetadataField>,
  fields: MongoRuleField[],
): MongoMetadataIndexEntry[] {
  const index: MongoMetadataIndexEntry[] = [];

  for (const field of fields) {
    const item = metadata[field.key];
    if (!item) continue;

    const raw = item.normalizedValue ?? item.value;
    if (raw === null || raw === '') continue;

    if (field.type === 'date') {
      const parsed = new Date(String(raw));
      if (!Number.isNaN(parsed.getTime())) {
        index.push({ key: field.key, type: 'date', valueDate: parsed });
      }
      continue;
    }

    if (field.type === 'currency' || field.type === 'number') {
      const amount = typeof raw === 'number' ? raw : Number.parseFloat(String(raw));
      if (Number.isFinite(amount)) {
        index.push({ key: field.key, type: 'number', valueNumber: amount });
      }
      continue;
    }

    index.push({
      key: field.key,
      type: 'string',
      valueString: String(raw).toLowerCase(),
    });
  }

  return index;
}

function mapVersionMetadata(
  metadata: MetadataExtractionResult['metadata'],
): Record<string, MongoVersionMetadataField> {
  const mapped: Record<string, MongoVersionMetadataField> = {};

  for (const [key, field] of Object.entries(metadata)) {
    mapped[key] = {
      label: field.label,
      value: field.value,
      normalizedValue: field.normalizedValue ?? field.value,
      confidence: field.confidence,
      source: field.source === 'no_ai' ? 'ai' : 'ai',
      page: field.evidence?.pageNumber,
      ...(field.currency ? { currency: field.currency } : {}),
      ...(field.evidence ? { evidence: field.evidence } : {}),
    };
  }

  return mapped;
}

function buildMetadataPreview(
  metadata: Record<string, MongoVersionMetadataField>,
): Record<string, string | number | null> {
  const preview: Record<string, string | number | null> = {};

  for (const [key, field] of Object.entries(metadata)) {
    preview[key] = field.normalizedValue ?? field.value;
  }

  return preview;
}

function buildDocumentTitle(className: string, metadata: Record<string, MongoVersionMetadataField>) {
  const reveladora =
    metadata.parte_reveladora?.normalizedValue ?? metadata.parte_reveladora?.value;
  const receptora =
    metadata.parte_receptora?.normalizedValue ?? metadata.parte_receptora?.value;
  const fornecedor = metadata.fornecedor?.normalizedValue ?? metadata.fornecedor?.value;
  const numeroNota = metadata.numero_nota?.value;

  if (reveladora && receptora) {
    return `${className} — ${reveladora} e ${receptora}`;
  }

  const party =
    receptora ?? reveladora ?? fornecedor ?? numeroNota;

  if (party) {
    return `${className} — ${party}`;
  }

  return className;
}

async function generateDocumentCode(ctx: DocumentRequestContext): Promise<string> {
  const { documents } = ctx.collections;
  const year = new Date().getFullYear();
  const count = await documents.countDocuments(buildDocumentOwnershipFilter(ctx.storage));
  return `DOQYN-${year}-${String(count + 1).padStart(6, '0')}`;
}

function buildStoragePlaceholders(): MongoDocumentVersion['storage'] {
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

async function persistConfirmedVersionFile(input: {
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
}): Promise<MongoDocumentVersion['storage']> {
  if (!isStorageConfigured()) {
    return buildStoragePlaceholders();
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
    mimeType: 'application/pdf',
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
    mimeType: 'application/pdf',
    originalFileName: input.originalFileName,
    storageFileName: input.storageFileName,
    storageScope: input.storageScope,
  });

  await deleteAnalysisStaging({
    tenantId: input.tenantId,
    ownerUserId: input.ownerUserId,
    jobId: input.jobId,
    mimeType: 'application/pdf',
    originalFileName: input.originalFileName,
    storageScope: input.storageScope,
  });

  return storage;
}

function buildProcessingSteps(input: ConfirmAnalysisInput, persistedAt: Date) {
  const baseSteps = input.logs.map((log) => ({
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
      key: 'persisted',
      label: 'Metadados salvos',
      status: 'done' as const,
      createdAt: persistedAt,
    },
  ];
}

export async function confirmAnalysisPersistence(input: {
  payload: ConfirmAnalysisInput;
  user: AuthUser;
  ctx: DocumentRequestContext;
  requestId?: string;
}): Promise<{
  documentId: string;
  versionId: string;
  status: 'saved';
  documentCode: string;
  storageStatus: 'stored' | 'pending';
}> {
  const tenantId = input.ctx.tenantId;
  const data = confirmAnalysisSchema.parse(input.payload);

  if (!data.classification.classId) {
    throw new ConfirmAnalysisError(
      'Classificação inválida. Não é possível confirmar sem uma classe identificada.',
      'INVALID_CLASSIFICATION',
      400,
    );
  }

  const needsReview =
    data.classification.requiresReview || data.extraction.requiresReview;

  if (needsReview && !data.manualReviewConfirmed) {
    throw new ConfirmAnalysisError(
      'Este documento requer revisão manual antes de ser confirmado.',
      'REQUIRES_REVIEW',
      409,
    );
  }

  const namingModeResolved = (data.namingMode ?? 'ai_suggested') as NamingMode;
  const aiSuggestedFileName = data.aiSuggestedFileName ?? data.recommendedFileName ?? '';
  const resolvedFinalFileName = data.finalFileName?.trim();

  if (
    namingModeResolved === 'ai_suggested' &&
    !resolvedFinalFileName &&
    !aiSuggestedFileName.trim()
  ) {
    throw new ConfirmAnalysisError(
      'Nome sugerido ausente. Não é possível salvar o documento.',
      'MISSING_RECOMMENDED_NAME',
      400,
    );
  }

  if (namingModeResolved === 'original' && !data.originalFileName?.trim()) {
    throw new ConfirmAnalysisError(
      'Nome original ausente. Não é possível salvar o documento.',
      'MISSING_ORIGINAL_NAME',
      400,
    );
  }

  const diagnostics = await diagnoseClassAndRuleLookup({
    companyId: tenantId,
    classId: data.classification.classId,
    className: data.classification.className,
    ownerUserId: input.ctx.userId,
  });

  logger.info('Validando classe e regra antes de persistir documento.', {
    requestId: input.requestId,
    companyId: diagnostics.companyId,
    classId: diagnostics.classId,
    className: diagnostics.className,
    database: diagnostics.database,
    documentClassFound: diagnostics.documentClassFound,
    documentRuleFound: diagnostics.documentRuleFound,
    activeClassesCount: diagnostics.activeClassesCount,
    activeRulesCount: diagnostics.activeRulesCount,
    configuredDatabase: getMongoDatabaseName(),
  });

  const classAndRule = await getMongoClassAndRule({
    companyId: tenantId,
    classId: data.classification.classId,
    ownerUserId: input.ctx.userId,
  });

  if (!classAndRule) {
    logger.warn('confirm-analysis class/rule lookup failed', {
      requestId: input.requestId,
      companyId: diagnostics.companyId,
      classId: diagnostics.classId,
      className: diagnostics.className,
      database: diagnostics.database,
      documentClassFound: diagnostics.documentClassFound,
      documentRuleFound: diagnostics.documentRuleFound,
      activeClassesCount: diagnostics.activeClassesCount,
      activeRulesCount: diagnostics.activeRulesCount,
      setupHint:
        diagnostics.activeClassesCount === 0
          ? 'Execute npm run db:setup para popular classes e regras em doqyn_dev.'
          : diagnostics.documentClassFound
            ? 'Classe encontrada, mas regra ativa ausente para este classId.'
            : 'classId não encontrado em document_classes para este companyId.',
    });

    throw new ConfirmAnalysisError(
      'Classe ou regra ativa não encontrada no sistema.',
      'CLASS_OR_RULE_NOT_FOUND',
      404,
    );
  }

  const { docClass, rule } = classAndRule;

  const categoryAccess = await resolveCategoryAccessGroupIds(tenantId, docClass._id, {
    ownerUserId: input.ctx.userId,
  });

  const legacyPermissions =
    'permissions' in docClass && docClass.permissions
      ? docClass.permissions
      : {
          view: categoryAccess.viewGroupIds,
          download: categoryAccess.downloadGroupIds,
          update: categoryAccess.updateGroupIds,
          audit: categoryAccess.auditGroupIds,
          share: categoryAccess.shareGroupIds,
        };

  if (!canConfirmDocuments(input.user, legacyPermissions.update)) {
    throw new ConfirmAnalysisError(
      'Você não tem permissão para confirmar metadados desta classe de documento.',
      'FORBIDDEN',
      403,
    );
  }

  const now = new Date();
  const documentId = `doc_${randomUUID()}`;
  const versionId = `ver_${randomUUID()}`;
  const jobId = data.jobId ?? `job_${randomUUID()}`;

  const versionMetadata = mapVersionMetadata(
    data.extraction.metadata as MetadataExtractionResult['metadata'],
  );
  const metadataIndex = buildMetadataIndex(
    data.extraction.metadata as Record<string, ExtractedMetadataField>,
    rule.fields,
  );
  const documentCode = await generateDocumentCode(input.ctx);
  const sha256 = data.fileHash;

  const versionLabel = data.extraction.version || 'v1.0';
  const versionNumber = Number.parseInt(versionLabel.replace(/[^\d]/g, ''), 10) || 1;
  const reviewReasons = [
    ...new Set([
      ...(data.classification.requiresReview ? [data.classification.reason] : []),
      ...data.extraction.reviewReasons,
    ]),
  ].filter(Boolean);

  const auditAction = needsReview
    ? 'document.metadata.reviewed_confirmed'
    : 'document.metadata.confirmed';

  const auditDescription = needsReview
    ? 'Documento salvo após revisão manual dos metadados extraídos.'
    : 'Documento criado a partir da análise automática confirmada pelo usuário.';

  let resolvedNames;
  try {
    resolvedNames = resolveStorageFileNames({
      originalFileName: data.originalFileName,
      aiSuggestedFileName,
      namingMode: namingModeResolved,
      manualName: data.selectedFileName ?? data.finalFileName,
      finalFileName: data.finalFileName,
      documentId,
      versionLabel,
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      throw new ConfirmAnalysisError(error.message, error.code, error.statusCode);
    }
    throw error;
  }

  let versionStorage: MongoDocumentVersion['storage'] = buildStoragePlaceholders();
  let persistedObjectKey: string | null = null;
  let persistedBucketAlias: string | null = null;

  try {
    versionStorage = await persistConfirmedVersionFile({
      tenantId,
      ownerUserId: input.ctx.userId,
      documentId,
      versionId,
      jobId: data.jobId,
      fileHash: sha256,
      fileSizeBytes: data.fileSizeBytes,
      originalFileName: data.originalFileName,
      storageFileName: resolvedNames.storageFileName,
      storageScope: input.ctx.storageScope,
    });
    persistedObjectKey = versionStorage.primary.objectKey;
    persistedBucketAlias = versionStorage.primary.bucketAlias;
  } catch (error) {
    if (error instanceof ConfirmAnalysisError) {
      throw error;
    }
    logger.error('confirm-analysis storage persistence failed', {
      requestId: input.requestId,
      message: error instanceof Error ? error.message : 'unknown',
    });
    throw new ConfirmAnalysisError(
      'Não foi possível persistir o arquivo do documento.',
      'STORAGE_PERSISTENCE_FAILED',
      500,
    );
  }

  const previewResult = await generateDocumentPreviewForVersion({
    tenantId,
    documentId,
    versionId,
    contentType: 'application/pdf',
    storageScope: input.ctx.storageScope,
    primary: versionStorage.primary,
    previewStorageFileName: resolvedNames.previewStorageFileName,
  });
  versionStorage = {
    ...versionStorage,
    preview: previewResult.slot,
  };

  const document = withTenantFieldsFromContext(
    input.ctx.storage,
    {
      _id: documentId,
      documentCode,
      currentVersionId: versionId,
      classId: docClass._id,
      className: docClass.name,
      title: buildDocumentTitle(docClass.name, versionMetadata),
      currentFileName: resolvedNames.finalFileName,
      status: 'active',
      processingStatus: needsReview ? 'processed_with_review' : 'processed',
      access: {
        viewGroupIds: legacyPermissions.view,
        downloadGroupIds: legacyPermissions.download,
        updateGroupIds: legacyPermissions.update,
        auditGroupIds: legacyPermissions.audit,
        shareGroupIds: legacyPermissions.share,
      },
      currentMetadataPreview: buildMetadataPreview(versionMetadata),
      createdBy: input.user.id,
      createdAt: now,
      updatedAt: now,
    },
    input.user.id,
  ) as MongoDocument;

  const version = withTenantFieldsFromContext(
    input.ctx.storage,
    {
      _id: versionId,
      documentId,
      versionNumber,
      versionLabel,
      previousVersionId: null,
      originalFileName: data.originalFileName,
      recommendedFileName: resolvedNames.aiSuggestedFileName,
      aiSuggestedFileName: resolvedNames.aiSuggestedFileName,
      selectedFileName: resolvedNames.selectedFileName,
      finalFileName: resolvedNames.finalFileName,
      namingMode: resolvedNames.namingMode,
      storageFileName: resolvedNames.storageFileName,
      previewStorageFileName: resolvedNames.previewStorageFileName,
      file: {
        mimeType: 'application/pdf',
        extension: 'pdf',
        sizeBytes: data.fileSizeBytes,
        sha256,
        pageCount: data.textExtraction.pageCount,
      },
      classification: {
        classId: data.classification.classId!,
        className: data.classification.className ?? docClass.name,
        confidence: data.classification.confidence,
        requiresReview: needsReview,
        reason: data.classification.reason,
        evidence: data.classification.evidence,
      },
      rule: {
        ruleId: rule._id,
        ruleVersion: rule.version,
      },
      metadata: versionMetadata,
      metadataIndex,
      storage: versionStorage,
      previewManifest: previewResult.previewManifest ?? undefined,
      review: {
        required: needsReview,
        reasons: needsReview ? reviewReasons : [],
        reviewedBy: needsReview ? input.user.id : input.user.id,
        reviewedAt: now,
      },
      createdBy: input.user.id,
      createdAt: now,
    },
    input.user.id,
  ) as MongoDocumentVersion;

  const processingJob = withTenantFieldsFromContext(
    input.ctx.storage,
    {
      _id: jobId,
      documentId,
      versionId,
      type: 'pdf_analysis',
      status: 'completed',
      steps: buildProcessingSteps(data, now),
      error: null,
      createdBy: input.user.id,
      createdAt: now,
      completedAt: now,
    },
    input.user.id,
  ) as MongoProcessingJob;

  const { documents, documentVersions, processingJobs } = input.ctx.collections;

  try {
    await documents.insertOne(document);
    await documentVersions.insertOne(version);
    await processingJobs.insertOne(processingJob);
  } catch (error) {
    if (persistedObjectKey) {
      await getStorageProvider()
        ?.deleteDocumentVersion(persistedObjectKey, tenantId, persistedBucketAlias)
        .catch(() => undefined);
    }
    throw error;
  }

  const auditCtx = buildDocumentAuditContext(input.ctx, input.user);
  const namingChanges = buildAuditChangeSet(
    {
      aiSuggestedFileName: resolvedNames.aiSuggestedFileName,
      selectedFileName: data.selectedFileName ?? null,
      finalFileName: data.finalFileName ?? null,
    },
    {
      aiSuggestedFileName: resolvedNames.aiSuggestedFileName,
      selectedFileName: resolvedNames.selectedFileName,
      finalFileName: resolvedNames.finalFileName,
    },
    ['aiSuggestedFileName', 'selectedFileName', 'finalFileName'],
  );

  const filenameUpdatedEvent = buildFilenameUpdatedAuditEvent({
    namingMode: namingModeResolved,
    originalFileName: data.originalFileName,
    aiSuggestedFileName: resolvedNames.aiSuggestedFileName,
    recommendedFileName: data.recommendedFileName,
    selectedFileName: data.selectedFileName,
    resolved: resolvedNames,
    documentId,
    versionId,
    occurredAt: new Date(now.getTime() + 1.5),
  });

  const documentNameSnapshot = buildDocumentNameSnapshot({
    finalFileName: resolvedNames.finalFileName,
    storageFileName: resolvedNames.storageFileName,
    previewStorageFileName: resolvedNames.previewStorageFileName,
    aiSuggestedFileName: resolvedNames.aiSuggestedFileName,
    recommendedFileName: data.recommendedFileName,
    originalFileName: data.originalFileName,
  });

  const documentTarget = {
    type: 'document' as const,
    id: documentId,
    nameSnapshot: documentNameSnapshot,
  };

  const auditEvents: DocumentAuditEventInput[] = [
    {
      action: 'document.review_confirmed',
      description: auditDescription,
      documentId,
      versionId,
      analysisJobId: jobId,
      result: 'success',
      target: documentTarget,
      metadata: sanitizeAuditMetadata({
        documentName: documentNameSnapshot,
        className: docClass.name,
        categoryId: docClass._id,
        categoryName: docClass.name,
        versionLabel,
        namingMode: namingModeResolved,
        hasRecommendedFileName: Boolean(data.recommendedFileName?.trim()),
        hasDocumentCode: Boolean(documentCode),
        manualReviewConfirmed: data.manualReviewConfirmed,
        legacyAction: auditAction,
        source: 'api',
      }),
      changes: namingChanges.length ? namingChanges : undefined,
      occurredAt: now,
    },
    {
      action: 'document.version_created',
      description: 'Nova versão do documento criada.',
      documentId,
      versionId,
      target: documentTarget,
      metadata: sanitizeAuditMetadata({
        documentName: documentNameSnapshot,
        classId: docClass._id,
        hasDocumentCode: Boolean(documentCode),
        storageStatus: versionStorage.primary.status,
        versionLabel,
        source: 'api',
      }),
      occurredAt: new Date(now.getTime() + 1),
    },
  ];

  if (filenameUpdatedEvent) {
    auditEvents.push(filenameUpdatedEvent);
  }

  if (versionStorage.primary.status === 'stored') {
    auditEvents.push({
      action: 'document.storage_promoted',
      description: 'Arquivo promovido ao storage definitivo.',
      documentId,
      versionId,
      target: documentTarget,
      metadata: sanitizeAuditMetadata({
        documentName: documentNameSnapshot,
        storageProvider: versionStorage.primary.provider,
        bucketAlias: versionStorage.primary.bucketAlias,
        storageStatus: versionStorage.primary.status,
        namingMode: resolvedNames.namingMode,
        storageFileName: resolvedNames.storageFileName,
        previewStorageFileName: resolvedNames.previewStorageFileName,
        source: 'api',
      }),
      occurredAt: new Date(now.getTime() + 2),
    });
  }

  if (previewResult.slot.status === 'ready') {
    auditEvents.push({
      action: 'document.preview_generated',
      description: 'Preview do documento gerado com sucesso.',
      documentId,
      versionId,
      target: documentTarget,
      metadata: sanitizeAuditMetadata({
        documentName: documentNameSnapshot,
        previewStatus: previewResult.slot.status,
        storageProvider: previewResult.slot.provider,
        bucketAlias: previewResult.slot.bucketAlias,
        previewStorageFileName: resolvedNames.previewStorageFileName,
        source: 'api',
      }),
      occurredAt: new Date(now.getTime() + 3),
    });
  } else if (previewResult.slot.status === 'failed') {
    auditEvents.push({
      action: 'document.preview_failed',
      description: 'Falha ao gerar preview do documento.',
      documentId,
      versionId,
      result: 'error',
      target: documentTarget,
      metadata: sanitizeAuditMetadata({
        documentName: documentNameSnapshot,
        previewStatus: previewResult.slot.status,
        reason: previewResult.slot.errorCode ?? previewResult.slot.errorMessage,
        source: 'api',
      }),
      occurredAt: new Date(now.getTime() + 3),
    });
  }

  await createDocumentAuditLogs(auditCtx, auditEvents).catch(() => undefined);

  return {
    documentId,
    versionId,
    status: 'saved',
    documentCode,
    storageStatus: versionStorage.primary.status === 'stored' ? 'stored' : 'pending',
  };
}

export function isConfirmAnalysisError(error: unknown): error is ConfirmAnalysisError {
  return error instanceof ConfirmAnalysisError;
}
