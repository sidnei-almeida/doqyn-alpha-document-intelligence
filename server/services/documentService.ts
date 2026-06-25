import { nanoid } from 'nanoid';
import { createHash } from 'node:crypto';
import { isMongoNativeConfigured } from '../db/mongoClient.js';
import type { MongoAuditLog, MongoDocument, MongoDocumentVersion } from '../db/types.js';
import { logger } from '../utils/logger.js';
import { getTenantCollections } from '../tenancy/getTenantCollections.js';
import { tenantScopeFilter, withTenantFields } from '../tenancy/tenantQuery.js';
import { ServiceError } from '../utils/serviceErrors.js';
import { sanitizeAuditMetadata } from '../utils/sanitizeAuditMetadata.js';
import { createProcessingJob } from './processingService.js';
import { extractMetadata } from './metadataService.js';
import { classifyDocument } from './documentClassificationService.js';

export interface UploadInput {
  tenantId: string;
  ownerUserId: string;
  ownerName: string;
  originalFileName: string;
  displayName: string;
  documentType: string;
  accessGroups: string[];
  notes?: string;
  fileSize: number;
  mimeType: string;
  fileBuffer?: Buffer;
}

function requireTenantId(tenantId?: string): string {
  if (!tenantId?.trim()) {
    throw new ServiceError('tenantId é obrigatório.', 'TENANT_REQUIRED', 400);
  }
  return tenantId.trim();
}

export async function uploadDocument(input: UploadInput) {
  const tenantId = requireTenantId(input.tenantId);
  const hash = input.fileBuffer
    ? createHash('sha256').update(input.fileBuffer).digest('hex')
    : `sim-${nanoid(16)}`;

  const area = input.accessGroups[0] ?? 'Geral';
  const versionId = nanoid();
  const documentId = nanoid();
  const now = new Date();

  if (!isMongoNativeConfigured()) {
    logger.info('Upload simulado (sem MongoDB)', { fileName: input.originalFileName });
    const simulatedDoc = {
      id: documentId,
      tenantId,
      originalFileName: input.originalFileName,
      displayName: input.displayName,
      documentType: input.documentType,
      status: 'analyzing' as const,
      version: 1,
      currentVersionId: versionId,
      ownerUserId: input.ownerUserId,
      ownerName: input.ownerName,
      area,
      accessGroups: input.accessGroups,
      metadata: await extractMetadata(input),
      processingStatus: 'in_progress' as const,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    return { document: simulatedDoc, versionId };
  }

  const { documents, documentVersions, auditLogs } = await getTenantCollections(tenantId);
  const metadata = await extractMetadata(input);
  const classification = await classifyDocument(input.documentType, metadata);

  const document = withTenantFields(tenantId, {
    _id: documentId,
    documentCode: `UP-${documentId.slice(0, 8).toUpperCase()}`,
    originalFileName: input.originalFileName,
    displayName: input.displayName,
    documentType: input.documentType,
    title: input.displayName,
    currentFileName: input.originalFileName,
    classId: 'unclassified',
    className: input.documentType,
    status: 'active',
    processingStatus: 'pending',
    version: 1,
    currentVersionId: versionId,
    ownerUserId: input.ownerUserId,
    ownerName: input.ownerName,
    area,
    accessGroups: input.accessGroups,
    access: {
      viewGroupIds: input.accessGroups,
      downloadGroupIds: input.accessGroups,
      updateGroupIds: input.accessGroups,
      auditGroupIds: input.accessGroups,
      shareGroupIds: input.accessGroups,
    },
    currentMetadataPreview: {},
    metadata: { ...metadata, classification },
    processingStatusLegacy: 'in_progress',
    createdBy: input.ownerUserId,
    createdAt: now,
    updatedAt: now,
  });

  await documents.insertOne(document as unknown as MongoDocument);

  const version = withTenantFields(tenantId, {
    _id: versionId,
    documentId,
    versionNumber: 1,
    versionLabel: 'v1',
    previousVersionId: null,
    originalFileName: input.originalFileName,
    recommendedFileName: input.displayName,
    finalFileName: input.displayName,
    file: {
      mimeType: input.mimeType,
      extension: input.originalFileName.split('.').pop() ?? '',
      sizeBytes: input.fileSize,
      sha256: hash,
    },
    classification: {
      classId: 'unclassified',
      className: input.documentType,
      confidence: 0,
      requiresReview: true,
      reason: 'upload_legacy',
    },
    rule: { ruleId: 'none', ruleVersion: 0 },
    metadata: {},
    metadataIndex: [],
    storage: {
      primary: { provider: 'aws_s3', status: 'pending', objectKey: null, bucketAlias: null, storedAt: null },
      backup: { provider: 'cloudflare_r2', status: 'pending', objectKey: null, bucketAlias: null, storedAt: null },
    },
    review: { required: true, reasons: ['upload_legacy'], reviewedBy: null, reviewedAt: null },
    changeNotes: input.notes,
    uploadedBy: input.ownerName,
    createdBy: input.ownerUserId,
    createdAt: now,
    updatedAt: now,
  });

  await documentVersions.insertOne(version as unknown as MongoDocumentVersion);

  await auditLogs.insertOne(
    withTenantFields(tenantId, {
      _id: `audit_${nanoid(12)}`,
      documentId,
      versionId,
      actor: { userId: input.ownerUserId, name: input.ownerName, role: 'user' },
      action: 'document.created',
      description: `${input.displayName} enviado para análise`,
      area,
      result: 'success',
      metadata: sanitizeAuditMetadata({ source: 'upload_legacy' }),
      createdAt: now,
    }) as unknown as MongoAuditLog,
  );

  await createProcessingJob({
    tenantId,
    documentId,
    versionId,
  });

  return {
    document: {
      id: documentId,
      tenantId,
      originalFileName: input.originalFileName,
      displayName: input.displayName,
      documentType: input.documentType,
      status: 'analyzing',
      version: 1,
      currentVersionId: versionId,
      ownerUserId: input.ownerUserId,
      ownerName: input.ownerName,
      area,
      accessGroups: input.accessGroups,
      metadata: { ...metadata, classification },
      processingStatus: 'in_progress',
      createdAt: now,
      updatedAt: now,
    },
    versionId,
  };
}

export async function listDocuments(filters: {
  tenantId?: string;
  search?: string;
  status?: string;
  type?: string;
  area?: string;
}) {
  const tenantId = requireTenantId(filters.tenantId);

  if (!isMongoNativeConfigured()) {
    return { documents: [], total: 0 };
  }

  const { documents } = await getTenantCollections(tenantId);
  const query: Record<string, unknown> = {
    ...tenantScopeFilter(tenantId),
    deletedAt: { $in: [null, undefined] },
  };
  if (filters.status) query.status = filters.status;
  if (filters.type) query.documentType = filters.type;
  if (filters.area) query.area = filters.area;
  if (filters.search) {
    query.$or = [
      { displayName: { $regex: filters.search, $options: 'i' } },
      { title: { $regex: filters.search, $options: 'i' } },
      { documentType: { $regex: filters.search, $options: 'i' } },
    ];
  }

  const docs = await documents.find(query).sort({ updatedAt: -1 }).limit(50).toArray();
  const total = await documents.countDocuments(query);

  return {
    documents: docs.map((d) => ({
      id: String(d._id),
      tenantId: d.tenantId ?? d.companyId,
      originalFileName: (d as Record<string, unknown>).originalFileName as string | undefined ?? d.currentFileName,
      displayName: (d as Record<string, unknown>).displayName as string | undefined ?? d.title,
      documentType: (d as Record<string, unknown>).documentType as string | undefined ?? d.className,
      status: d.status,
      version: (d as Record<string, unknown>).version as number | undefined ?? 1,
      currentVersionId: d.currentVersionId,
      ownerUserId: d.ownerUserId,
      ownerName: (d as Record<string, unknown>).ownerName as string | undefined,
      area: (d as Record<string, unknown>).area as string | undefined,
      accessGroups: (d as Record<string, unknown>).accessGroups as string[] | undefined ?? d.access?.viewGroupIds,
      metadata: (d as Record<string, unknown>).metadata,
      processingStatus: d.processingStatus ?? (d as Record<string, unknown>).processingStatusLegacy,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    })),
    total,
  };
}

export async function getDocument(id: string, tenantId?: string) {
  const resolvedTenantId = requireTenantId(tenantId);

  if (!isMongoNativeConfigured()) return null;

  const { documents } = await getTenantCollections(resolvedTenantId);
  const doc = await documents.findOne({
    _id: id,
    ...tenantScopeFilter(resolvedTenantId),
  } as Record<string, unknown>);

  if (!doc) return null;

  return {
    id: String(doc._id),
    tenantId: doc.tenantId ?? doc.companyId,
    originalFileName: (doc as Record<string, unknown>).originalFileName as string | undefined ?? doc.currentFileName,
    displayName: (doc as Record<string, unknown>).displayName as string | undefined ?? doc.title,
    documentType: (doc as Record<string, unknown>).documentType as string | undefined ?? doc.className,
    status: doc.status,
    version: (doc as Record<string, unknown>).version as number | undefined ?? 1,
    currentVersionId: doc.currentVersionId,
    ownerUserId: doc.ownerUserId,
    ownerName: (doc as Record<string, unknown>).ownerName as string | undefined,
    area: (doc as Record<string, unknown>).area as string | undefined,
    accessGroups: (doc as Record<string, unknown>).accessGroups as string[] | undefined ?? doc.access?.viewGroupIds,
    metadata: (doc as Record<string, unknown>).metadata,
    processingStatus: doc.processingStatus ?? (doc as Record<string, unknown>).processingStatusLegacy,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
