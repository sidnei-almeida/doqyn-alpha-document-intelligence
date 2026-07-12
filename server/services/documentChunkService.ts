import { randomUUID } from 'node:crypto';
import type { DocumentChunk } from '../ai/types/documentAi.types.js';
import { createDocumentChunks } from '../ai/services/documentChunker.js';
import type { DocumentRequestContext } from '../tenancy/documentRequestContext.js';
import type { MongoDocumentChunk } from '../db/types.js';
import {
  buildDocumentOwnershipFilter,
  tenantScopeFilterFromContext,
  withTenantFieldsFromContext,
} from '../tenancy/tenantQuery.js';
import { logger } from '../utils/logger.js';
import { isMongoNativeConfigured } from '../db/mongoClient.js';

export type PersistDocumentChunksInput = {
  ctx: DocumentRequestContext;
  documentId: string;
  versionId: string;
  versionLabel: string;
  categoryId: string;
  isCurrentVersion: boolean;
  pdfBuffer: Buffer;
  mimeType?: string;
  createdBy: string;
};

export type RagChunkQueryInput = {
  ctx: DocumentRequestContext;
  documentId: string;
  versionId?: string;
  versionLabel?: string;
  currentOnly?: boolean;
};

export type RagChunkQueryResult = {
  documentId: string;
  versionId?: string;
  versionLabel?: string;
  isCurrentVersionFilter: boolean;
  chunks: MongoDocumentChunk[];
};

function buildChunkId(documentId: string, versionId: string, chunkIndex: number): string {
  return `chunk_${documentId}_${versionId}_${chunkIndex}`;
}

export function mapDocumentChunksToMongo(input: {
  chunks: DocumentChunk[];
  tenantFields: Record<string, unknown>;
  documentId: string;
  versionId: string;
  versionLabel: string;
  categoryId: string;
  isCurrentVersion: boolean;
  createdAt?: Date;
}): MongoDocumentChunk[] {
  const createdAt = input.createdAt ?? new Date();

  return input.chunks.map((chunk) => ({
  ...(input.tenantFields as MongoDocumentChunk),
    _id: buildChunkId(input.documentId, input.versionId, chunk.chunkIndex),
    documentId: input.documentId,
    versionId: input.versionId,
    versionLabel: input.versionLabel,
    isCurrentVersion: input.isCurrentVersion,
    categoryId: input.categoryId,
    chunkIndex: chunk.chunkIndex,
    pageNumber: chunk.pageNumber,
    text: chunk.text,
    charStart: chunk.charStart,
    charEnd: chunk.charEnd,
    embedding: null,
    createdAt,
  }));
}

export function buildRagChunkFilter(input: RagChunkQueryInput): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    documentId: input.documentId,
    ...tenantScopeFilterFromContext(input.ctx.storage),
  };

  if (input.currentOnly !== false) {
    filter.isCurrentVersion = true;
    if (input.ctx.storage.storageMode === 'shared_individual_collection' && input.ctx.userId) {
      filter.ownerUserId = input.ctx.userId;
    }
    return filter;
  }

  if (input.versionId) {
    filter.versionId = input.versionId;
  } else if (input.versionLabel) {
    filter.versionLabel = input.versionLabel;
  }

  return filter;
}

export async function createChunksFromPdfBuffer(buffer: Buffer): Promise<DocumentChunk[]> {
  return createChunksFromDocumentBuffer(buffer, 'application/pdf');
}

export async function createChunksFromDocumentBuffer(
  buffer: Buffer,
  mimeType = 'application/pdf',
): Promise<DocumentChunk[]> {
  const { extractTextFromDocument } = await import('../ai/services/documentTextExtractor.js');
  const extracted = await extractTextFromDocument(buffer, mimeType);
  return createDocumentChunks(extracted);
}

export async function persistDocumentVersionChunks(
  input: PersistDocumentChunksInput,
): Promise<{ chunkCount: number }> {
  if (!isMongoNativeConfigured()) {
    logger.info('Chunks simulados (Mongo indisponível)', {
      documentId: input.documentId,
      versionId: input.versionId,
      versionLabel: input.versionLabel,
    });
    return { chunkCount: 0 };
  }

  const chunks = await createChunksFromDocumentBuffer(
    input.pdfBuffer,
    input.mimeType ?? 'application/pdf',
  );
  if (chunks.length === 0) {
    return { chunkCount: 0 };
  }

  const { documentChunks } = input.ctx.collections;
  const tenantFields = withTenantFieldsFromContext(
    input.ctx.storage,
    {},
    input.createdBy,
  ) as Record<string, unknown>;

  if (input.isCurrentVersion) {
    await documentChunks.updateMany(
      {
        documentId: input.documentId,
        isCurrentVersion: true,
        ...tenantScopeFilterFromContext(input.ctx.storage),
        ...buildDocumentOwnershipFilter(input.ctx.storage),
      } as Record<string, unknown>,
      { $set: { isCurrentVersion: false } },
    );
  }

  const records = mapDocumentChunksToMongo({
    chunks,
    tenantFields,
    documentId: input.documentId,
    versionId: input.versionId,
    versionLabel: input.versionLabel,
    categoryId: input.categoryId,
    isCurrentVersion: input.isCurrentVersion,
  });

  await documentChunks.insertMany(records);

  logger.info('Chunks persistidos para versão do documento', {
    documentId: input.documentId,
    versionId: input.versionId,
    versionLabel: input.versionLabel,
    chunkCount: records.length,
    isCurrentVersion: input.isCurrentVersion,
  });

  return { chunkCount: records.length };
}

export async function updateDocumentChunksCategory(input: {
  ctx: DocumentRequestContext;
  documentId: string;
  categoryId: string;
}): Promise<{ modifiedCount: number }> {
  if (!isMongoNativeConfigured()) {
    return { modifiedCount: 0 };
  }

  const { documentChunks } = input.ctx.collections;
  const result = await documentChunks.updateMany(
    {
      documentId: input.documentId,
      ...tenantScopeFilterFromContext(input.ctx.storage),
      ...buildDocumentOwnershipFilter(input.ctx.storage),
    } as Record<string, unknown>,
    { $set: { categoryId: input.categoryId } },
  );

  return { modifiedCount: result.modifiedCount ?? 0 };
}

export async function queryDocumentChunksForRag(
  input: RagChunkQueryInput,
): Promise<RagChunkQueryResult> {
  if (!isMongoNativeConfigured()) {
    return {
      documentId: input.documentId,
      versionId: input.versionId,
      versionLabel: input.versionLabel,
      isCurrentVersionFilter: input.currentOnly !== false,
      chunks: [],
    };
  }

  const filter = buildRagChunkFilter(input);
  const chunks = await input.ctx.collections.documentChunks
    .find(filter as Record<string, unknown>)
    .sort({ chunkIndex: 1 })
    .toArray();

  return {
    documentId: input.documentId,
    versionId: input.versionId,
    versionLabel: input.versionLabel,
    isCurrentVersionFilter: input.currentOnly !== false,
    chunks: chunks as MongoDocumentChunk[],
  };
}

export async function countDocumentVersionChunks(input: {
  ctx: DocumentRequestContext;
  documentId: string;
  versionId?: string;
  versionLabel?: string;
  currentOnly?: boolean;
}): Promise<number> {
  if (!isMongoNativeConfigured()) return 0;

  const filter = buildRagChunkFilter({
    ctx: input.ctx,
    documentId: input.documentId,
    versionId: input.versionId,
    versionLabel: input.versionLabel,
    currentOnly: input.currentOnly,
  });

  return input.ctx.collections.documentChunks.countDocuments(filter as Record<string, unknown>);
}

export function mongoChunksToDocumentChunks(chunks: MongoDocumentChunk[]): DocumentChunk[] {
  return chunks.map((chunk) => ({
    id: chunk._id || randomUUID(),
    pageNumber: chunk.pageNumber,
    chunkIndex: chunk.chunkIndex,
    text: chunk.text,
    charStart: chunk.charStart,
    charEnd: chunk.charEnd,
  }));
}
