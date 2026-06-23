import { nanoid } from 'nanoid';
import { createHash } from 'node:crypto';
import { connectMongo } from '../db/mongo.js';
import { AuditEventModel } from '../models/AuditEvent.js';
import { DocumentModel } from '../models/Document.js';
import { DocumentVersionModel } from '../models/DocumentVersion.js';
import { logger } from '../utils/logger.js';
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

export async function uploadDocument(input: UploadInput) {
  const hash = input.fileBuffer
    ? createHash('sha256').update(input.fileBuffer).digest('hex')
    : `sim-${nanoid(16)}`;

  const area = input.accessGroups[0] ?? 'Geral';
  const versionId = nanoid();

  await connectMongo();

  if (!process.env.MONGODB_URI) {
    logger.info('Upload simulado (sem MongoDB)', { fileName: input.originalFileName });
    const simulatedDoc = {
      id: nanoid(),
      tenantId: input.tenantId,
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return { document: simulatedDoc, versionId };
  }

  const doc = await DocumentModel.create({
    tenantId: input.tenantId,
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
    metadata: {},
    processingStatus: 'in_progress',
  });

  await DocumentVersionModel.create({
    documentId: doc._id.toString(),
    version: 1,
    originalFileName: input.originalFileName,
    displayName: input.displayName,
    fileSize: input.fileSize,
    mimeType: input.mimeType,
    hash,
    uploadedBy: input.ownerName,
    changeNotes: input.notes,
    status: 'pending_analysis',
  });

  await AuditEventModel.create({
    tenantId: input.tenantId,
    documentId: doc._id.toString(),
    actorUserId: input.ownerUserId,
    actorName: input.ownerName,
    action: 'document_uploaded',
    description: `${input.displayName} enviado para análise`,
    area,
    result: 'success',
  });

  const metadata = await extractMetadata(input);
  const classification = await classifyDocument(input.documentType, metadata);

  await DocumentModel.findByIdAndUpdate(doc._id, {
    metadata: { ...metadata, classification },
  });

  await createProcessingJob({
    tenantId: input.tenantId,
    documentId: doc._id.toString(),
    versionId,
  });

  return {
    document: {
      id: doc._id.toString(),
      tenantId: doc.tenantId,
      originalFileName: doc.originalFileName,
      displayName: doc.displayName,
      documentType: doc.documentType,
      status: doc.status,
      version: doc.version,
      currentVersionId: doc.currentVersionId,
      ownerUserId: doc.ownerUserId,
      ownerName: doc.ownerName,
      area: doc.area,
      accessGroups: doc.accessGroups,
      metadata: { ...metadata, classification },
      processingStatus: doc.processingStatus,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
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
  await connectMongo();

  if (!process.env.MONGODB_URI) {
    return { documents: [], total: 0 };
  }

  const query: Record<string, unknown> = { deletedAt: null };
  if (filters.tenantId) query.tenantId = filters.tenantId;
  if (filters.status) query.status = filters.status;
  if (filters.type) query.documentType = filters.type;
  if (filters.area) query.area = filters.area;
  if (filters.search) query.$text = { $search: filters.search };

  const docs = await DocumentModel.find(query).sort({ updatedAt: -1 }).limit(50).lean();
  const total = await DocumentModel.countDocuments(query);

  return {
    documents: docs.map((d) => ({
      id: String(d._id),
      tenantId: d.tenantId,
      originalFileName: d.originalFileName,
      displayName: d.displayName,
      documentType: d.documentType,
      status: d.status,
      version: d.version,
      currentVersionId: d.currentVersionId,
      ownerUserId: d.ownerUserId,
      ownerName: d.ownerName,
      area: d.area,
      accessGroups: d.accessGroups,
      metadata: d.metadata,
      processingStatus: d.processingStatus,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    })),
    total,
  };
}

export async function getDocument(id: string) {
  await connectMongo();
  if (!process.env.MONGODB_URI) return null;

  const doc = await DocumentModel.findById(id).lean();
  if (!doc || Array.isArray(doc)) return null;

  return {
    id: String(doc._id),
    tenantId: doc.tenantId,
    originalFileName: doc.originalFileName,
    displayName: doc.displayName,
    documentType: doc.documentType,
    status: doc.status,
    version: doc.version,
    currentVersionId: doc.currentVersionId,
    ownerUserId: doc.ownerUserId,
    ownerName: doc.ownerName,
    area: doc.area,
    accessGroups: doc.accessGroups,
    metadata: doc.metadata,
    processingStatus: doc.processingStatus,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
