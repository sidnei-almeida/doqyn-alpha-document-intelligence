import type { AuthUser } from '../auth/types.js';
import { completeChatConversation } from '../ai/services/groqClient.js';
import {
  buildDocumentChatMessages,
  type DocumentChatClassification,
  type DocumentChatHistoryMessage,
  type DocumentChatMetadataField,
} from '../ai/utils/documentChatPrompt.js';
import type { DocumentChunk, RetrievedChunk } from '../ai/types/documentAi.types.js';
import {
  resolveDocumentChatLocale,
  type DocumentChatLocale,
} from '../ai/utils/aiConfig.js';
import { logger } from '../utils/logger.js';
import { redisGetJson, redisSetJson } from '../redis/redisClient.js';
import {
  createChunksFromDocumentBuffer,
  mongoChunksToDocumentChunks,
  queryDocumentChunksForRag,
  type RagChunkQueryInput,
} from './documentChunkService.js';
import { readDocumentVersionFile } from './documentFileService.js';
import { selectChunksForQuestion } from './retrievalProvider.js';

export type DocumentChatCitation = {
  chunkIndex: number;
  pageNumber?: number;
  score: number;
};

export type DocumentChatQueryInput = {
  ctx: RagChunkQueryInput['ctx'];
  documentId: string;
  documentName: string;
  categoryName?: string;
  question: string;
  history?: DocumentChatHistoryMessage[];
  topK?: number;
  requestId?: string;
  /** Necessário para localizar o arquivo no R2 quando o documento ainda não tem chunks persistidos. */
  versionId: string;
  user: AuthUser;
  membershipId?: string;
  /** Grounding opcional a partir dos dados já extraídos pela análise de IA. */
  classification?: DocumentChatClassification;
  metadataFields?: DocumentChatMetadataField[];
  /** Locale do cliente (header x-doqyn-locale), usado nas mensagens estáticas do chat. */
  locale?: unknown;
};

export type DocumentChatQueryResponse = {
  documentId: string;
  answer: string;
  citations: DocumentChatCitation[];
  chunkCount: number;
};

export function buildChatCitations(chunks: RetrievedChunk[]): DocumentChatCitation[] {
  return chunks.map((chunk) => ({
    chunkIndex: chunk.chunkIndex,
    pageNumber: chunk.pageNumber,
    score: chunk.score,
  }));
}

/** Resposta padrão quando o documento não tem (e não foi possível extrair) texto para consulta. */
const NO_CONTENT_ANSWERS: Record<DocumentChatLocale, string> = {
  'pt-BR':
    'Ainda não consigo ler o conteúdo deste documento para responder perguntas sobre ele. ' +
    'Isso costuma acontecer com PDFs escaneados ou baseados em imagem, sem texto extraível. ' +
    'Se achar que é um engano, entre em contato com o suporte.',
  'es-PY':
    'Todavía no puedo leer el contenido de este documento para responder preguntas sobre él. ' +
    'Esto suele ocurrir con PDFs escaneados o basados en imágenes, sin texto extraíble. ' +
    'Si cree que esto es un error, comuníquese con soporte.',
  'en-US':
    "I still can't read this document's content to answer questions about it. " +
    'This usually happens with scanned or image-based PDFs with no extractable text. ' +
    'If you think this is a mistake, contact support.',
};

function resolveNoContentAnswer(locale: unknown): string {
  return NO_CONTENT_ANSWERS[resolveDocumentChatLocale(locale)];
}

/** TTL do cache efêmero de chunks — renovado a cada pergunta, expira sozinho se a conversa parar. */
const EPHEMERAL_CHUNKS_TTL_SECONDS = 60 * 60;

function ephemeralChunksCacheKey(documentId: string, versionId: string): string {
  return `document-chat:chunks:${documentId}:${versionId}`;
}

/**
 * Documentos enviados antes do chat existir nunca tiveram chunks gerados/persistidos. Em vez de
 * gravar esse texto extraído permanentemente no Mongo (custo de storage por documento que talvez
 * nunca mais seja consultado), extraímos o PDF já armazenado no R2 e geramos os chunks só em
 * memória, cacheados de forma efêmera no Redis — nunca tocam a coleção `documentChunks`.
 */
async function getEphemeralChunksForChat(input: DocumentChatQueryInput): Promise<DocumentChunk[]> {
  const cacheKey = ephemeralChunksCacheKey(input.documentId, input.versionId);

  const cached = await redisGetJson<DocumentChunk[]>(cacheKey);
  if (cached && cached.length > 0) {
    void redisSetJson(cacheKey, cached, EPHEMERAL_CHUNKS_TTL_SECONDS);
    return cached;
  }

  try {
    const file = await readDocumentVersionFile({
      tenantId: input.ctx.tenantId,
      ownerUserId: input.ctx.userId,
      documentId: input.documentId,
      versionId: input.versionId,
      storageScope: input.ctx.storageScope,
      user: input.user,
      membershipId: input.membershipId,
    });

    const chunks = await createChunksFromDocumentBuffer(file.buffer, file.mimeType);

    if (chunks.length > 0) {
      logger.info('Chunks efêmeros gerados sob demanda para chat documental', {
        documentId: input.documentId,
        versionId: input.versionId,
        chunkCount: chunks.length,
      });
      await redisSetJson(cacheKey, chunks, EPHEMERAL_CHUNKS_TTL_SECONDS);
    }

    return chunks;
  } catch (error) {
    logger.warn('Geração de chunks efêmeros falhou no chat documental', {
      documentId: input.documentId,
      versionId: input.versionId,
      message: error instanceof Error ? error.message : 'unknown',
    });
    return [];
  }
}

export async function answerDocumentChatQuestion(
  input: DocumentChatQueryInput,
): Promise<DocumentChatQueryResponse> {
  const result = await queryDocumentChunksForRag({
    ctx: input.ctx,
    documentId: input.documentId,
    currentOnly: true,
  });

  let documentChunks = mongoChunksToDocumentChunks(result.chunks);

  if (documentChunks.length === 0) {
    documentChunks = await getEphemeralChunksForChat(input);
  }

  if (documentChunks.length === 0) {
    return {
      documentId: input.documentId,
      answer: resolveNoContentAnswer(input.locale),
      citations: [],
      chunkCount: 0,
    };
  }

  const retrieved = selectChunksForQuestion({
    chunks: documentChunks,
    question: input.question,
    topK: input.topK,
  });

  const messages = buildDocumentChatMessages({
    documentName: input.documentName,
    categoryName: input.categoryName,
    chunks: retrieved,
    history: input.history,
    question: input.question,
    classification: input.classification,
    metadataFields: input.metadataFields,
  });

  const answer = await completeChatConversation(messages, {
    context: { requestId: input.requestId, operation: 'document_chat' },
  });

  return {
    documentId: input.documentId,
    answer,
    citations: buildChatCitations(retrieved),
    chunkCount: retrieved.length,
  };
}
