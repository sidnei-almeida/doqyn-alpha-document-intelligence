import type { RetrievedChunk } from '../types/documentAi.types.js';
import { formatChunksForPrompt } from '../../services/retrievalProvider.js';
import type { GroqChatMessage } from '../services/groqClient.js';

export type DocumentChatHistoryMessage = { role: 'user' | 'assistant'; content: string };

export type DocumentChatMetadataField = {
  label: string;
  value: string | number;
};

export type DocumentChatClassification = {
  className: string;
  confidence: number;
};

const ASSISTANT_NAME = 'Doqy';

function formatMetadataForPrompt(fields?: DocumentChatMetadataField[]): string {
  if (!fields || fields.length === 0) return '';
  const lines = fields.map((field) => `- ${field.label}: ${field.value}`).join('\n');
  return `\n\nDados já extraídos deste documento pela análise automática (use como contexto confiável, mas prefira citar o trecho do texto quando existir):\n${lines}`;
}

function buildSystemPrompt(input: {
  documentName: string;
  categoryName?: string;
  classification?: DocumentChatClassification;
  metadataFields?: DocumentChatMetadataField[];
  chunks: RetrievedChunk[];
}): string {
  const categoryLine = input.categoryName ? ` (categoria: ${input.categoryName})` : '';
  const confidenceLine = input.classification
    ? ` Classificado como "${input.classification.className}" com ${Math.round(input.classification.confidence * 100)}% de confiança.`
    : '';

  return `Você é ${ASSISTANT_NAME}, o assistente de leitura de documentos do DOQYN. Você já leu "${input.documentName}"${categoryLine} de ponta a ponta e conversa sobre ele com confiança e naturalidade, como alguém que realmente conhece o conteúdo — não como um buscador de palavras-chave.${confidenceLine}

Como responder:
1. Responda SEMPRE no mesmo idioma da pergunta do usuário (detecte o idioma da mensagem mais recente dele, não o idioma do documento). Se ainda não houver pergunta para detectar o idioma, responda em português (pt-BR). Vá direto ao ponto, com um tom seguro e prestativo — sem rodeios nem linguagem robótica.
2. Baseie-se SOMENTE nos trechos do documento e nos dados extraídos abaixo — não invente informação que não esteja neles.
3. Se a resposta não estiver disponível, diga isso claramente e, se fizer sentido, sugira o que a pessoa pode perguntar em vez disso — não deixe a conversa travada num "não sei".
4. Cite a página do trecho usado quando possível (ex.: "página 2"), de forma natural dentro da frase, não como uma nota à parte.
5. Para perguntas de "o que é esse documento" ou similares, use os dados extraídos e o nome do documento para dar uma resposta rica sem precisar repetir tudo que já foi extraído.

Trechos do documento:
${formatChunksForPrompt(input.chunks)}${formatMetadataForPrompt(input.metadataFields)}`;
}

export function buildDocumentChatMessages(input: {
  documentName: string;
  categoryName?: string;
  classification?: DocumentChatClassification;
  metadataFields?: DocumentChatMetadataField[];
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
