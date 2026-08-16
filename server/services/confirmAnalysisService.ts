import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { ExtractedMetadataField } from '../ai/types/documentAi.types.js';
import { canConfirmDocuments } from '../auth/permissions.js';
import { resolveCategoryAccessGroupIds } from './documentAccessRulesService.js';
import type { DocumentRequestContext } from '../tenancy/documentRequestContext.js';
import {
  buildDocumentOwnershipFilter,
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
  diagnoseClassAndRuleLookup,
  getMongoClassAndRule,
} from './documentRulesService.js';
import { sanitizeAuditMetadata } from '../utils/sanitizeAuditMetadata.js';
import { getMongoDatabaseName } from '../db/database.js';
import { logger } from '../utils/logger.js';
import { getStorageProvider } from '../storage/index.js';
import {
  enqueueScheduledDocumentPreview,
  scheduleDocumentPreviewForVersion,
} from './preview/documentPreviewScheduling.js';
import { ServiceError } from '../utils/serviceErrors.js';
import {
  resolveStorageFileNames,
  type NamingMode,
} from '../utils/resolveStorageFileNames.js';
import { normalizeVersionLabel, parseMajorVersionNumber } from '../utils/versionLabelUtils.js';
import { scheduleChunkPersistenceAfterVersionConfirm } from './confirmVersionChunkPersistence.js';
import { resolveDocumentOwnerName } from '../utils/userDisplayName.js';
import {
  buildInitialDocumentOwnershipFields,
} from '../utils/documentMutationFields.js';
import { resolveAnalysisMimeType } from '../ai/constants.js';
import {
  ConfirmAnalysisError,
  assertAiSuggestedNamePresent,
  requireConfirmClassification,
  buildDocumentTitle,
  buildProcessingSteps,
  buildStoragePlaceholders,
  isConfirmAnalysisError,
  mapVersionMetadata,
  persistConfirmedVersionFile,
  projectDocumentSearchMeta,
} from './confirm/confirmVersionShared.js';

export { ConfirmAnalysisError, isConfirmAnalysisError };

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

/**
 * Origens que o pipeline pode carimbar num campo extraído.
 *
 * O `Record` não é decoração: ele obriga o compilador a exigir uma entrada para cada membro de
 * `ExtractedMetadataField['source']`. Foi a falta disso que quebrou o produto — `derived` entrou
 * no pipeline (data final calculada a partir de âncora + prazo, em `deriveEndDates`) sem entrar
 * aqui, e todo documento com data derivada era recusado no confirm com "Payload inválido", sem
 * nada no log dizendo qual campo. Agora a fonte nova quebra o build, não o upload do cliente.
 */
const METADATA_FIELD_SOURCE_MAP: Record<ExtractedMetadataField['source'], true> = {
  document_text: true,
  no_ai: true,
  derived: true,
};

const METADATA_FIELD_SOURCES = Object.keys(METADATA_FIELD_SOURCE_MAP) as [
  ExtractedMetadataField['source'],
  ...ExtractedMetadataField['source'][],
];

const metadataFieldSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number(), z.null()]),
  normalizedValue: z.union([z.string(), z.number(), z.null()]).optional(),
  confidence: z.number(),
  source: z.enum(METADATA_FIELD_SOURCES).optional().default('document_text'),
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

/**
 * Nome opcional que aceita `null` como "não veio".
 *
 * A análise devolve `recommendedFileName: null` sempre que não chega a sugerir nome — o caso
 * normal quando a classificação fica inconclusiva. O cliente repassa esse `null` adiante, e um
 * `.optional()` seco só aceita `undefined`: o documento era recusado com "Payload inválido" na
 * confirmação, justamente no caminho em que o usuário revisou e decidiu salvar assim mesmo.
 */
const optionalName = z
  .string()
  .min(1)
  .nullish()
  .transform((value) => value ?? undefined);

export const confirmAnalysisSchema = z.object({
  jobId: z.string().optional(),
  originalFileName: z.string().min(1),
  mimeType: optionalName,
  recommendedFileName: optionalName,
  aiSuggestedFileName: optionalName,
  namingMode: z.enum(['ai_suggested', 'original', 'manual']).optional().default('ai_suggested'),
  finalFileName: optionalName,
  selectedFileName: optionalName,
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

async function generateDocumentCode(ctx: DocumentRequestContext): Promise<string> {
  const { documents } = ctx.collections;
  const year = new Date().getFullYear();
  const count = await documents.countDocuments(buildDocumentOwnershipFilter(ctx.storage));
  return `DOQYN-${year}-${String(count + 1).padStart(6, '0')}`;
}

export async function confirmAnalysisPersistence(input: {
  payload: ConfirmAnalysisInput;
  user: AuthUser;
  ctx: DocumentRequestContext;
  requestId?: string;
  /** Dono do documento quando um administrador confirma em nome de outro usuário. */
  documentOwnerUserId?: string;
  /** Nome exibido do proprietário (ex.: envio aprovado na auditoria). */
  documentOwnerDisplayName?: string;
  skipConfirmPermissionCheck?: boolean;
}): Promise<{
  documentId: string;
  versionId: string;
  status: 'saved';
  documentCode: string;
  storageStatus: 'stored' | 'pending';
}> {
  const tenantId = input.ctx.tenantId;
  const ownerUserId = input.documentOwnerUserId?.trim() || input.ctx.userId;
  const ownerName = await resolveDocumentOwnerName({
    tenantId,
    ownerUserId,
    displayNameHint: input.documentOwnerDisplayName,
    actor: input.user,
  });
  const ownershipFields = buildInitialDocumentOwnershipFields({ ownerUserId, ownerName });
  const data = confirmAnalysisSchema.parse(input.payload);
  const contentMimeType =
    resolveAnalysisMimeType({
      fileName: data.originalFileName,
      mimeType: data.mimeType,
    }) ?? 'application/pdf';

  const classId = requireConfirmClassification({
    classId: data.classification.classId,
    requiresReview: data.classification.requiresReview,
    extractionRequiresReview: data.extraction.requiresReview,
    manualReviewConfirmed: data.manualReviewConfirmed,
  });
  const needsReview =
    data.classification.requiresReview || data.extraction.requiresReview;

  const namingModeResolved = (data.namingMode ?? 'ai_suggested') as NamingMode;
  const aiSuggestedFileName = data.aiSuggestedFileName ?? data.recommendedFileName ?? '';
  const resolvedFinalFileName = data.finalFileName?.trim();

  assertAiSuggestedNamePresent({
    namingMode: namingModeResolved,
    finalFileName: resolvedFinalFileName,
    aiSuggestedFileName,
  });

  if (namingModeResolved === 'original' && !data.originalFileName?.trim()) {
    throw new ConfirmAnalysisError(
      'Nome original ausente. Não é possível salvar o documento.',
      'MISSING_ORIGINAL_NAME',
      400,
    );
  }

  const diagnostics = await diagnoseClassAndRuleLookup({
    companyId: tenantId,
    classId,
    className: data.classification.className,
    ownerUserId,
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
    classId,
    ownerUserId,
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
            : 'classId não encontrado em document_categories para este tenant.',
    });

    throw new ConfirmAnalysisError(
      'Classe ou regra ativa não encontrada no sistema.',
      'CLASS_OR_RULE_NOT_FOUND',
      404,
    );
  }

  const { docClass, rule } = classAndRule;

  const categoryAccess = await resolveCategoryAccessGroupIds(tenantId, docClass._id, {
    ownerUserId,
  });

  // Snapshot informativo gravado no documento — o acesso em runtime é sempre
  // resolvido pelas regras de governança ativas, nunca por este snapshot.
  const legacyPermissions = {
    view: categoryAccess.viewGroupIds,
    download: categoryAccess.downloadGroupIds,
    update: categoryAccess.updateGroupIds,
    audit: categoryAccess.auditGroupIds,
    share: categoryAccess.shareGroupIds,
  };

  // Caminho de criação: o documento ainda não existe, então o dono em escopo é o dono que ele vai
  // receber (`ownerUserId`, resolvido acima). Quem cria o próprio documento confirma o metadado
  // dele sem depender de papel administrativo (D-09).
  if (!input.skipConfirmPermissionCheck && !canConfirmDocuments(input.user, { ownerUserId })) {
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

  const versionMetadata = mapVersionMetadata(data.extraction.metadata);
  const searchMeta = projectDocumentSearchMeta(versionMetadata, rule.fields);
  const documentCode = await generateDocumentCode(input.ctx);
  const sha256 = data.fileHash;

  const versionLabel = normalizeVersionLabel(data.extraction.version || 'v1.0');
  const versionNumber = parseMajorVersionNumber(versionLabel);
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
  let confirmedPdfBuffer: Buffer | null = null;

  try {
    const persisted = await persistConfirmedVersionFile({
      tenantId,
      ownerUserId,
      documentId,
      versionId,
      jobId: data.jobId,
      fileHash: sha256,
      fileSizeBytes: data.fileSizeBytes,
      originalFileName: data.originalFileName,
      storageFileName: resolvedNames.storageFileName,
      storageScope: input.ctx.storageScope,
      mimeType: contentMimeType,
    });
    versionStorage = persisted.storage;
    confirmedPdfBuffer = persisted.buffer;
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

  const previewResult = await scheduleDocumentPreviewForVersion({
    tenantId,
    documentId,
    versionId,
    contentType: contentMimeType,
    storageScope: input.ctx.storageScope,
    primary: versionStorage.primary,
    previewStorageFileName: resolvedNames.previewStorageFileName,
    ownerUserId,
    requestId: input.requestId,
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
      currentVersionLabel: versionLabel,
      versionCount: 1,
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
      searchMeta,
      ownerUserId: ownershipFields.ownerUserId,
      ownerName: ownershipFields.ownerName,
      createdBy: ownershipFields.createdBy,
      updatedBy: ownershipFields.updatedBy,
      updatedByName: ownershipFields.updatedByName,
      createdAt: ownershipFields.createdAt,
      updatedAt: ownershipFields.updatedAt,
    },
    ownerUserId,
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
        mimeType: contentMimeType,
        extension: 'pdf',
        sizeBytes: data.fileSizeBytes,
        sha256,
        pageCount: data.textExtraction.pageCount,
      },
      classification: {
        classId,
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
      storage: versionStorage,
      previewManifest: previewResult.previewManifest ?? undefined,
      review: {
        required: needsReview,
        reasons: needsReview ? reviewReasons : [],
        reviewedBy: needsReview ? input.user.id : input.user.id,
        reviewedAt: now,
      },
      uploadedBy: ownerName,
      createdBy: ownerUserId,
      createdAt: now,
    },
    ownerUserId,
  ) as MongoDocumentVersion;

  const processingJob = withTenantFieldsFromContext(
    input.ctx.storage,
    {
      _id: jobId,
      documentId,
      versionId,
      type: 'pdf_analysis',
      status: 'completed',
      steps: buildProcessingSteps(data.logs, now, {
        key: 'persisted',
        label: 'Metadados salvos',
      }),
      error: null,
      createdBy: ownerUserId,
      createdAt: now,
      completedAt: now,
    },
    ownerUserId,
  ) as MongoProcessingJob;

  const { documents, documentVersions, processingJobs } = input.ctx.collections;

  try {
    await documents.insertOne(document);
    await documentVersions.insertOne(version);
    await processingJobs.insertOne(processingJob);

    if (confirmedPdfBuffer) {
      await scheduleChunkPersistenceAfterVersionConfirm({
        ctx: input.ctx,
        pdfBuffer: confirmedPdfBuffer,
        documentId,
        versionId,
        versionLabel,
        categoryId: docClass._id,
        createdBy: ownerUserId,
        isCurrentVersion: true,
        mimeType: contentMimeType,
      });
    }

    if (previewResult.asyncQueued) {
      await enqueueScheduledDocumentPreview({
        tenantId,
        documentId,
        versionId,
        contentType: contentMimeType,
        storageScope: input.ctx.storageScope,
        primary: versionStorage.primary,
        previewStorageFileName: resolvedNames.previewStorageFileName,
        ownerUserId,
        requestId: input.requestId,
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
    documentOwnerUserId: ownerUserId,
  });
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
