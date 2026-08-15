import type { DocumentRequestContext } from '../tenancy/documentRequestContext.js';
import { persistDocumentVersionChunks } from './documentChunkService.js';
import { enqueueEmbeddingJob } from '../queues/embeddingQueue.js';
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
      return;
    }

    // O vetor é gerado fora do request: custa segundos e ~280 MB de modelo. Falha ao enfileirar
    // não derruba a confirmação — o documento fica gravado e buscável por texto, só entra na
    // busca semântica quando o backfill ou uma nova confirmação passar por ele.
    try {
      const enqueued = await enqueueEmbeddingJob({
        tenantId: input.ctx.tenantId,
        documentId: input.documentId,
        versionId: input.versionId,
        userId: input.ctx.userId,
        membershipId: input.ctx.membershipId,
      });

      if (!enqueued) {
        logger.info('Vetorização não enfileirada (fila desligada)', {
          documentId: input.documentId,
          versionId: input.versionId,
        });
      }
    } catch (error) {
      logger.error('Falha ao enfileirar vetorização da versão confirmada', {
        documentId: input.documentId,
        versionId: input.versionId,
        message: error instanceof Error ? error.message : 'unknown',
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
