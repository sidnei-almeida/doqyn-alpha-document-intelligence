import { completeChatConversation } from '../ai/services/groqClient.js';
import { buildDocumentChatMessages, type DocumentChatHistoryMessage } from '../ai/utils/documentChatPrompt.js';
import type { RetrievedChunk } from '../ai/types/documentAi.types.js';
import { mongoChunksToDocumentChunks, queryDocumentChunksForRag, type RagChunkQueryInput } from './documentChunkService.js';
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

export async function answerDocumentChatQuestion(
  input: DocumentChatQueryInput,
): Promise<DocumentChatQueryResponse> {
  const result = await queryDocumentChunksForRag({
    ctx: input.ctx,
    documentId: input.documentId,
    currentOnly: true,
  });

  const documentChunks = mongoChunksToDocumentChunks(result.chunks);
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
