import type { RetrievedChunk } from '../types/documentAi.types.js';
import { formatChunksForPrompt } from '../../services/retrievalProvider.js';
import type { GroqChatMessage } from '../services/groqClient.js';

export type DocumentChatHistoryMessage = { role: 'user' | 'assistant'; content: string };

function buildSystemPrompt(input: {
  documentName: string;
  categoryName?: string;
  chunks: RetrievedChunk[];
}): string {
  const categoryLine = input.categoryName ? ` (categoria: ${input.categoryName})` : '';

  return `Você é o assistente de conversa documental do DOQYN. Responda em português (pt-BR) sobre o documento "${input.documentName}"${categoryLine}.

Regras:
1. Responda SOMENTE com base nos trechos do documento abaixo.
2. Se a resposta não estiver nos trechos, diga claramente que não encontrou a informação no documento — não invente.
3. Cite a página do trecho usado quando possível (ex.: "página 2").
4. Seja objetivo e direto.

Trechos do documento:
${formatChunksForPrompt(input.chunks)}`;
}

export function buildDocumentChatMessages(input: {
  documentName: string;
  categoryName?: string;
  chunks: RetrievedChunk[];
  history?: DocumentChatHistoryMessage[];
  question: string;
}): GroqChatMessage[] {
  return [
    { role: 'system', content: buildSystemPrompt(input) },
    ...(input.history ?? []),
    { role: 'user', content: input.question },
  ];
}
