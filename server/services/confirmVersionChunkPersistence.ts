import type { DocumentRequestContext } from '../tenancy/documentRequestContext.js';
import { persistDocumentVersionChunks } from './documentChunkService.js';
import { logger } from '../utils/logger.js';

export async function persistChunksAfterVersionConfirm(input: {
  ctx: DocumentRequestContext;
  pdfBuffer: Buffer;
  documentId: string;
  versionId: string;
  versionLabel: string;
  categoryId: string;
  createdBy: string;
  isCurrentVersion?: boolean;
}): Promise<void> {
  try {
    const { chunkCount } = await persistDocumentVersionChunks({
      ctx: input.ctx,
      pdfBuffer: input.pdfBuffer,
      documentId: input.documentId,
      versionId: input.versionId,
      versionLabel: input.versionLabel,
      categoryId: input.categoryId,
      createdBy: input.createdBy,
      isCurrentVersion: input.isCurrentVersion ?? true,
    });

    if (chunkCount === 0) {
      logger.warn('Nenhum chunk gerado para versão confirmada', {
        documentId: input.documentId,
        versionId: input.versionId,
      });
    }
  } catch (error) {
    logger.error('Falha ao persistir chunks da versão confirmada', {
      documentId: input.documentId,
      versionId: input.versionId,
      message: error instanceof Error ? error.message : 'unknown',
    });
  }
}
