import { authFetch, getFetchCredentials, withAuthHeaders } from '@/auth/apiAuth';
import { i18n } from '@/i18n';

export type DocumentChatRole = 'user' | 'assistant';

export type DocumentChatHistoryMessage = {
  role: DocumentChatRole;
  content: string;
};

export type DocumentChatCitation = {
  chunkIndex: number;
  pageNumber?: number;
  score: number;
};

export type DocumentChatResponse = {
  documentId: string;
  answer: string;
  citations: DocumentChatCitation[];
  chunkCount: number;
};

export async function askDocumentChatQuestion(
  documentId: string,
  question: string,
  history: DocumentChatHistoryMessage[],
): Promise<DocumentChatResponse> {
  const response = await authFetch(`/api/documents/${encodeURIComponent(documentId)}/chat`, {
    method: 'POST',
    credentials: getFetchCredentials(),
    headers: withAuthHeaders({
      'Content-Type': 'application/json',
      'x-doqyn-locale': i18n.language,
    }),
    body: JSON.stringify({ question, history }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Erro ao consultar o documento.' }));
    throw new Error(error.message ?? `HTTP ${response.status}`);
  }

  return response.json();
}
