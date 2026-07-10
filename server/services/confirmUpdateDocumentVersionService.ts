import { randomUUID } from 'node:crypto';
import type { DocumentRequestContext } from '../tenancy/documentRequestContext.js';
import type { TenantStorageScope } from '../tenancy/resolveTenantStorageScope.js';
import {
  withTenantFieldsFromContext,
} from '../tenancy/tenantQuery.js';
import type {
  MongoDocument,
  MongoDocumentVersion,
  MongoProcessingJob,
} from '../db/types.js';
import type { AuthUser } from '../auth/types.js';
import { buildDocumentAuditContext } from '../audit/buildDocumentAuditContext.js';
import { buildFilenameUpdatedAuditEvent } from '../audit/buildFilenameUpdatedAuditEvent.js';
import { buildAuditChangeSet } from '../audit/documentAuditHelpers.js';
import { createDocumentAuditLogs } from '../audit/documentAuditLogService.js';
import { buildDocumentNameSnapshot } from '../audit/documentNameSnapshot.js';
import type { DocumentAuditEventInput } from '../audit/documentAuditTypes.js';
import {
  buildDocumentMutationFields,
  resolveDocumentActorIdentity,
} from '../utils/documentMutationFields.js';
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
import { z } from 'zod';
import {
  confirmAnalysisSchema,
  ConfirmAnalysisError,
  isConfirmAnalysisError,
  type ConfirmAnalysisInput,
} from './confirmAnalysisService.js';
import { assertCanUpdateExistingDocument } from './documentVersionService.js';
import {
  nextMajorVersionLabel,
  normalizeVersionLabel,
  parseMajorVersionNumber,
} from '../utils/versionLabelUtils.js';
import {
  diagnoseClassAndRuleLookup,
  getMongoClassAndRule,
} from './documentRulesService.js';
import { canConfirmDocuments } from '../auth/permissions.js';
import { loadDocumentAccessContext, resolveDocumentPermissions } from '../tenancy/documentAccess.js';
import { getMongoDatabaseName } from '../db/database.js';
import { persistChunksAfterVersionConfirm } from './confirmVersionChunkPersistence.js';

export { ConfirmAnalysisError, isConfirmAnalysisError };

export const confirmUpdateSchema = confirmAnalysisSchema.extend({
  documentId: z.string().min(1, 'documentId é obrigatório.'),
});

export type ConfirmUpdateDocumentVersionInput = z.infer<typeof confirmUpdateSchema>;

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
}): Promise<{ storage: MongoDocumentVersion['storage']; buffer: Buffer | null }> {
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

  return { storage, buffer };
}

function buildDocumentTitle(className: string, metadata: MongoDocumentVersion['metadata']) {
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

function mapVersionMetadata(
  metadata: ConfirmAnalysisInput['extraction']['metadata'],
): MongoDocumentVersion['metadata'] {
  const mapped: MongoDocumentVersion['metadata'] = {};
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
  metadata: MongoDocumentVersion['metadata'],
): Record<string, string | number | null> {
  const preview: Record<string, string | number | null> = {};
  for (const [key, field] of Object.entries(metadata)) {
    preview[key] = field.normalizedValue ?? field.value;
  }
  return preview;
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
      key: 'version_persisted',
      label: 'Nova versão salva',
      status: 'done' as const,
      createdAt: persistedAt,
    },
  ];
}

export async function confirmUpdateDocumentVersionPersistence(input: {
  payload: ConfirmUpdateDocumentVersionInput;
  user: AuthUser;
  ctx: DocumentRequestContext;
  requestId?: string;
}): Promise<{
  documentId: string;
  versionId: string;
  previousVersionId: string;
  versionLabel: string;
  status: 'updated';
  storageStatus: 'stored' | 'pending';
}> {
  const tenantId = input.ctx.tenantId;
  const data = confirmUpdateSchema.parse(input.payload);
  const documentId = data.documentId.trim();

  const existingDoc = await assertCanUpdateExistingDocument({
    documentId,
    tenantId,
    ownerUserId: input.ctx.userId,
    user: input.user,
    membershipId: input.ctx.membershipId,
  });

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

  const diagnostics = await diagnoseClassAndRuleLookup({
    companyId: tenantId,
    classId: data.classification.classId,
    className: data.classification.className,
    ownerUserId: input.ctx.userId,
  });

  logger.info('Validando classe e regra antes de atualizar versão do documento.', {
    requestId: input.requestId,
    documentId,
    companyId: diagnostics.companyId,
    classId: diagnostics.classId,
    database: diagnostics.database,
    configuredDatabase: getMongoDatabaseName(),
  });

  const classAndRule = await getMongoClassAndRule({
    companyId: tenantId,
    classId: data.classification.classId,
    ownerUserId: input.ctx.userId,
  });

  if (!classAndRule) {
    throw new ConfirmAnalysisError(
      'Classe ou regra ativa não encontrada no sistema.',
      'CLASS_OR_RULE_NOT_FOUND',
      404,
    );
  }

  const { docClass, rule } = classAndRule;

  const accessCtx = await loadDocumentAccessContext({
    tenantId,
    userId: input.ctx.userId,
    membershipId: input.ctx.membershipId,
  });
  const documentPermissions = resolveDocumentPermissions(
    input.user,
    existingDoc,
    accessCtx.memberGroupIds,
    accessCtx.governanceIndex,
  );

  if (!documentPermissions.canContribute) {
    throw new ConfirmAnalysisError(
      'Você não tem permissão para enviar nova versão deste documento.',
      'FORBIDDEN',
      403,
    );
  }

  if (!canConfirmDocuments(input.user, existingDoc.access?.updateGroupIds ?? [])) {
    throw new ConfirmAnalysisError(
      'A confirmação de nova versão requer aprovação de um administrador.',
      'REQUIRES_ADMIN_APPROVAL',
      403,
    );
  }

  const { documentVersions } = input.ctx.collections;
  const previousVersionId = existingDoc.currentVersionId;
  const previousVersion = await documentVersions.findOne({
    _id: previousVersionId,
    documentId,
  } as Record<string, unknown>);

  const previousLabel =
    (existingDoc as MongoDocument & { currentVersionLabel?: string }).currentVersionLabel ??
    (previousVersion as MongoDocumentVersion | null)?.versionLabel;

  const versionLabel = nextMajorVersionLabel(previousLabel);
  const versionNumber = parseMajorVersionNumber(versionLabel);
  const versionCount =
    ((existingDoc as MongoDocument & { versionCount?: number }).versionCount ?? 1) + 1;

  const now = new Date();
  const versionId = `ver_${randomUUID()}`;
  const jobId = data.jobId ?? `job_${randomUUID()}`;

  const versionMetadata = mapVersionMetadata(data.extraction.metadata);
  const sha256 = data.fileHash;

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
  let confirmedPdfBuffer: Buffer | null = null;

  try {
    const persisted = await persistConfirmedVersionFile({
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
    versionStorage = persisted.storage;
    confirmedPdfBuffer = persisted.buffer;
    persistedObjectKey = versionStorage.primary.objectKey;
    persistedBucketAlias = versionStorage.primary.bucketAlias;
  } catch (error) {
    if (error instanceof ConfirmAnalysisError) {
      throw error;
    }
    logger.error('confirm-update storage persistence failed', {
      requestId: input.requestId,
      documentId,
      message: error instanceof Error ? error.message : 'unknown',
    });
    throw new ConfirmAnalysisError(
      'Não foi possível persistir o arquivo da nova versão.',
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

  const version = withTenantFieldsFromContext(
    input.ctx.storage,
    {
      _id: versionId,
      documentId,
      versionNumber,
      versionLabel,
      previousVersionId,
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
      metadataIndex: [],
      storage: versionStorage,
      previewManifest: previewResult.previewManifest ?? undefined,
      review: {
        required: needsReview,
        reasons: needsReview ? data.extraction.reviewReasons : [],
        reviewedBy: input.user.id,
        reviewedAt: now,
      },
      createdBy: input.user.id,
      createdAt: now,
    },
    existingDoc.ownerUserId ?? input.user.id,
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

  const { documents, processingJobs } = input.ctx.collections;

  const actor = await resolveDocumentActorIdentity({
    tenantId,
    actor: input.user,
  });
  const mutationFields = buildDocumentMutationFields({
    actorUserId: actor.userId,
    actorDisplayName: actor.displayName,
    now,
  });

  const documentUpdate: Record<string, unknown> = {
    currentVersionId: versionId,
    currentVersionLabel: versionLabel,
    versionCount,
    classId: docClass._id,
    className: docClass.name,
    title: buildDocumentTitle(docClass.name, versionMetadata),
    currentFileName: resolvedNames.finalFileName,
    processingStatus: needsReview ? 'processed_with_review' : 'processed',
    currentMetadataPreview: buildMetadataPreview(versionMetadata),
    ...mutationFields,
  };

  try {
    await documentVersions.insertOne(version);
    await documents.updateOne(
      { _id: documentId } as Record<string, unknown>,
      { $set: documentUpdate },
    );
    await processingJobs.insertOne(processingJob);

    if (confirmedPdfBuffer) {
      await persistChunksAfterVersionConfirm({
        ctx: input.ctx,
        pdfBuffer: confirmedPdfBuffer,
        documentId,
        versionId,
        versionLabel,
        categoryId: docClass._id,
        createdBy: input.user.id,
        isCurrentVersion: true,
      });
    }
  } catch (error) {
    if (persistedObjectKey) {
      await getStorageProvider()
        ?.deleteDocumentVersion(persistedObjectKey, tenantId, persistedBucketAlias)
        .catch(() => undefined);
    }
    throw error;
  }

  const auditCtx = buildDocumentAuditContext(input.ctx, input.user, input.requestId, {
    documentOwnerUserId: existingDoc.ownerUserId,
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

  const namingChanges = buildAuditChangeSet(
    {
      currentVersionId: previousVersionId,
      currentVersionLabel: normalizeVersionLabel(previousLabel),
    },
    {
      currentVersionId: versionId,
      currentVersionLabel: versionLabel,
    },
    ['currentVersionId', 'currentVersionLabel'],
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

  const auditEvents: DocumentAuditEventInput[] = [
    {
      action: 'document.review_confirmed',
      description: `Nova versão ${versionLabel} confirmada após análise.`,
      documentId,
      versionId,
      analysisJobId: jobId,
      result: 'success',
      target: documentTarget,
      metadata: sanitizeAuditMetadata({
        documentName: documentNameSnapshot,
        className: docClass.name,
        categoryId: docClass._id,
        versionLabel,
        previousVersionId,
        previousVersionLabel: normalizeVersionLabel(previousLabel),
        namingMode: namingModeResolved,
        manualReviewConfirmed: data.manualReviewConfirmed,
        source: 'api',
        updateMode: true,
      }),
      changes: namingChanges.length ? namingChanges : undefined,
      occurredAt: now,
    },
    {
      action: 'document.version_created',
      description: `Versão ${versionLabel} criada para documento existente.`,
      documentId,
      versionId,
      target: documentTarget,
      metadata: sanitizeAuditMetadata({
        documentName: documentNameSnapshot,
        versionLabel,
        previousVersionId,
        versionCount,
        storageStatus: versionStorage.primary.status,
        source: 'api',
        updateMode: true,
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
      description: 'Arquivo da nova versão promovido ao storage definitivo.',
      documentId,
      versionId,
      target: documentTarget,
      metadata: sanitizeAuditMetadata({
        documentName: documentNameSnapshot,
        storageProvider: versionStorage.primary.provider,
        bucketAlias: versionStorage.primary.bucketAlias,
        storageStatus: versionStorage.primary.status,
        storageFileName: resolvedNames.storageFileName,
        previewStorageFileName: resolvedNames.previewStorageFileName,
        versionLabel,
        source: 'api',
      }),
      occurredAt: new Date(now.getTime() + 2),
    });
  }

  if (previewResult.slot.status === 'ready') {
    auditEvents.push({
      action: 'document.preview_generated',
      description: 'Preview da nova versão gerado com sucesso.',
      documentId,
      versionId,
      target: documentTarget,
      metadata: sanitizeAuditMetadata({
        documentName: documentNameSnapshot,
        previewStatus: previewResult.slot.status,
        versionLabel,
        source: 'api',
      }),
      occurredAt: new Date(now.getTime() + 3),
    });
  }

  await createDocumentAuditLogs(auditCtx, auditEvents).catch(() => undefined);

  return {
    documentId,
    versionId,
    previousVersionId,
    versionLabel,
    status: 'updated',
    storageStatus: versionStorage.primary.status === 'stored' ? 'stored' : 'pending',
  };
}
