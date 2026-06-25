import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { ExtractedMetadataField, MetadataExtractionResult } from '../ai/types/documentAi.types.js';
import { canConfirmDocuments } from '../auth/permissions.js';
import { getTenantCollections } from '../tenancy/getTenantCollections.js';
import { tenantScopeFilter, withTenantFields } from '../tenancy/tenantQuery.js';
import type {
  MongoAuditLog,
  MongoDocument,
  MongoDocumentVersion,
  MongoMetadataIndexEntry,
  MongoProcessingJob,
  MongoRuleField,
  MongoVersionMetadataField,
} from '../db/types.js';
import type { AuthUser } from '../auth/types.js';
import {
  diagnoseClassAndRuleLookup,
  getMongoClassAndRule,
} from './documentRulesService.js';
import { sanitizeAuditMetadata } from '../utils/sanitizeAuditMetadata.js';
import { getMongoDatabaseName } from '../db/database.js';
import { logger } from '../utils/logger.js';

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
  recommendedFileName: z.string().min(1),
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
  const party =
    metadata.parte_receptora?.normalizedValue ??
    metadata.parte_receptora?.value ??
    metadata.fornecedor?.normalizedValue ??
    metadata.fornecedor?.value ??
    metadata.numero_nota?.value;

  if (party) {
    return `${className} — ${party}`;
  }

  return className;
}

async function generateDocumentCode(tenantId: string): Promise<string> {
  const { documents } = await getTenantCollections(tenantId);
  const year = new Date().getFullYear();
  const count = await documents.countDocuments(tenantScopeFilter(tenantId));
  return `DOQYN-${year}-${String(count + 1).padStart(6, '0')}`;
}

function buildStoragePlaceholders() {
  return {
    primary: {
      provider: 'aws_s3' as const,
      status: 'pending' as const,
      objectKey: null,
      bucketAlias: null,
      storedAt: null,
    },
    backup: {
      provider: 'cloudflare_r2' as const,
      status: 'pending' as const,
      objectKey: null,
      bucketAlias: null,
      storedAt: null,
    },
  };
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
  companyId: string;
  requestId?: string;
}): Promise<{
  documentId: string;
  versionId: string;
  status: 'saved';
  documentCode: string;
  storageStatus: 'pending';
}> {
  const tenantId = input.companyId;
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

  if (!data.recommendedFileName?.trim()) {
    throw new ConfirmAnalysisError(
      'Nome recomendado ausente. Não é possível salvar o documento.',
      'MISSING_RECOMMENDED_NAME',
      400,
    );
  }

  const diagnostics = await diagnoseClassAndRuleLookup({
    companyId: tenantId,
    classId: data.classification.classId,
    className: data.classification.className,
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

  if (!canConfirmDocuments(input.user, docClass.permissions.update)) {
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
  const auditId = `audit_${randomUUID()}`;

  const versionMetadata = mapVersionMetadata(
    data.extraction.metadata as MetadataExtractionResult['metadata'],
  );
  const metadataIndex = buildMetadataIndex(
    data.extraction.metadata as Record<string, ExtractedMetadataField>,
    rule.fields,
  );
  const documentCode = await generateDocumentCode(tenantId);
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

  const document = withTenantFields(
    tenantId,
    {
      _id: documentId,
      documentCode,
      currentVersionId: versionId,
      classId: docClass._id,
      className: docClass.name,
      title: buildDocumentTitle(docClass.name, versionMetadata),
      currentFileName: data.recommendedFileName,
      status: 'active',
      processingStatus: needsReview ? 'processed_with_review' : 'processed',
      access: {
        viewGroupIds: docClass.permissions.view,
        downloadGroupIds: docClass.permissions.download,
        updateGroupIds: docClass.permissions.update,
        auditGroupIds: docClass.permissions.audit,
        shareGroupIds: docClass.permissions.share,
      },
      currentMetadataPreview: buildMetadataPreview(versionMetadata),
      createdBy: input.user.id,
      createdAt: now,
      updatedAt: now,
    },
    input.user.id,
  ) as MongoDocument;

  const version = withTenantFields(
    tenantId,
    {
      _id: versionId,
      documentId,
      versionNumber,
      versionLabel,
      previousVersionId: null,
      originalFileName: data.originalFileName,
      recommendedFileName: data.recommendedFileName,
      finalFileName: data.recommendedFileName,
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
      storage: buildStoragePlaceholders(),
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

  const processingJob = withTenantFields(tenantId, {
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
  }) as MongoProcessingJob;

  const auditLog = withTenantFields(tenantId, {
    _id: auditId,
    documentId,
    versionId,
    actor: {
      userId: input.user.id,
      name: input.user.name,
      role: input.user.role,
    },
    action: auditAction,
    description: auditDescription,
    metadata: sanitizeAuditMetadata({
      className: docClass.name,
      classId: docClass._id,
      versionLabel,
      hasRecommendedFileName: Boolean(data.recommendedFileName?.trim()),
      hasDocumentCode: Boolean(documentCode),
    }),
    createdAt: now,
  }) as MongoAuditLog;

  const { documents, documentVersions, processingJobs, auditLogs } =
    await getTenantCollections(tenantId);

  await documents.insertOne(document);
  await documentVersions.insertOne(version);
  await processingJobs.insertOne(processingJob);
  await auditLogs.insertOne(auditLog);

  await auditLogs.insertOne(
    withTenantFields(tenantId, {
      _id: `audit_${randomUUID()}`,
      documentId,
      versionId,
      actor: auditLog.actor,
      action: 'document.created',
      description: 'Documento lógico criado no sistema.',
      metadata: sanitizeAuditMetadata({
        classId: docClass._id,
        hasDocumentCode: Boolean(documentCode),
      }),
      createdAt: new Date(now.getTime() + 1),
    }) as MongoAuditLog,
  );

  return {
    documentId,
    versionId,
    status: 'saved',
    documentCode,
    storageStatus: 'pending',
  };
}

export function isConfirmAnalysisError(error: unknown): error is ConfirmAnalysisError {
  return error instanceof ConfirmAnalysisError;
}
