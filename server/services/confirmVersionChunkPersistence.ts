import type { DocumentRequestContext } from '../tenancy/documentRequestContext.js';
import { persistDocumentVersionChunks } from './documentChunkService.js';
import { enqueueEmbeddingJob } from '../queues/embeddingQueue.js';
import { enqueueChunkingJob } from '../queues/chunkingQueue.js';
import { logger } from '../utils/logger.js';

export type VersionChunkPersistenceInput = {
  ctx: DocumentRequestContext;
  pdfBuffer: Buffer;
  documentId: string;
  versionId: string;
  versionLabel: string;
  categoryId: string;
  createdBy: string;
  isCurrentVersion?: boolean;
  mimeType?: string;
};

/**
 * Ponto de entrada da confirmação: enfileira o fatiamento e sai do caminho do usuário.
 *
 * Fatiar dentro do request custava os 4,4s medidos na auditoria de escala, e o pior não é a espera
 * de quem confirma: `pdf-parse` é CPU e, enquanto roda, o processo da API não atende mais ninguém.
 *
 * Sem fila — ou se o enfileiramento falhar — fatia aqui mesmo. É queda de propósito, e diferente do
 * embedding: trecho alimenta busca por texto e RAG, não existe backfill de trechos, e documento
 * confirmado sem trecho é documento que some da busca.
 */
export type ChunkPersistenceScheduleDeps = {
  enqueue?: typeof enqueueChunkingJob;
  persistInline?: (input: VersionChunkPersistenceInput) => Promise<void>;
};

export async function scheduleChunkPersistenceAfterVersionConfirm(
  input: VersionChunkPersistenceInput,
  deps: ChunkPersistenceScheduleDeps = {},
): Promise<{ mode: 'queued' | 'inline' }> {
  const enqueue = deps.enqueue ?? enqueueChunkingJob;
  const persistInline = deps.persistInline ?? persistChunksAfterVersionConfirm;

  try {
    const enqueued = await enqueue({
      tenantId: input.ctx.tenantId,
      documentId: input.documentId,
      versionId: input.versionId,
      versionLabel: input.versionLabel,
      categoryId: input.categoryId,
      createdBy: input.createdBy,
      isCurrentVersion: input.isCurrentVersion ?? true,
      mimeType: input.mimeType,
      userId: input.ctx.userId,
      membershipId: input.ctx.membershipId,
    });

    if (enqueued) return { mode: 'queued' };
  } catch (error) {
    // `reason`, não `message`: a meta é mesclada no registro e um `message` aqui apaga o título
    // do log — foi assim que o motivo virou o log inteiro nos outros pontos deste arquivo.
    logger.error('Falha ao enfileirar fatiamento da versão confirmada', {
      documentId: input.documentId,
      versionId: input.versionId,
      reason: error instanceof Error ? error.message : 'unknown',
    });
  }

  await persistInline(input);
  return { mode: 'inline' };
}

export async function persistChunksAfterVersionConfirm(
  input: VersionChunkPersistenceInput,
): Promise<void> {
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
      mimeType: input.mimeType,
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
