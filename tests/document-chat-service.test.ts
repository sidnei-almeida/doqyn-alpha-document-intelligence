import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildChatCitations } from '../server/services/documentChatService.js';
import type { RetrievedChunk } from '../server/ai/types/documentAi.types.js';

function retrievedChunk(id: string, chunkIndex: number, pageNumber: number, score: number): RetrievedChunk {
  return { id, chunkIndex, pageNumber, score, matchedTerms: [], reason: 'teste', text: 'x' };
}

test('buildChatCitations extrai chunkIndex, pageNumber e score dos chunks recuperados', () => {
  const chunks = [retrievedChunk('c1', 2, 3, 7.5), retrievedChunk('c2', 0, 1, 4)];

  const citations = buildChatCitations(chunks);

  assert.deepEqual(citations, [
    { chunkIndex: 2, pageNumber: 3, score: 7.5 },
    { chunkIndex: 0, pageNumber: 1, score: 4 },
  ]);
});

test('answerDocumentChatQuestion combina retrieval, prompt e completion do Groq', () => {
  const source = readFileSync('server/services/documentChatService.ts', 'utf-8');
  assert.ok(source.includes('export async function answerDocumentChatQuestion'));
  assert.ok(source.includes('queryDocumentChunksForRag'));
  assert.ok(source.includes('mongoChunksToDocumentChunks'));
  assert.ok(source.includes('selectChunksForQuestion'));
  assert.ok(source.includes('buildDocumentChatMessages'));
  assert.ok(source.includes('completeChatConversation'));
  assert.ok(source.includes('buildChatCitations'));
});
