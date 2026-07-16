import { strict as assert } from 'node:assert';
import test from 'node:test';
import { buildDocumentChatMessages } from '../server/ai/utils/documentChatPrompt.js';
import type { RetrievedChunk } from '../server/ai/types/documentAi.types.js';

function retrievedChunk(id: string, chunkIndex: number, text: string, pageNumber?: number): RetrievedChunk {
  return { id, chunkIndex, text, pageNumber, score: 1, matchedTerms: [], reason: 'teste' };
}

test('monta system prompt com nome do documento, trechos e instrução de não inventar', () => {
  const chunks = [retrievedChunk('c1', 0, 'A multa por rescisão antecipada será de R$ 5.000,00.', 2)];

  const messages = buildDocumentChatMessages({
    documentName: 'Contrato ACME.pdf',
    categoryName: 'Contrato',
    chunks,
    question: 'Qual o valor da multa?',
  });

  assert.equal(messages[0].role, 'system');
  assert.match(messages[0].content, /Contrato ACME\.pdf/);
  assert.match(messages[0].content, /Contrato/);
  assert.match(messages[0].content, /multa por rescisão/);
  assert.match(messages[0].content, /não invente|não inventar/i);
});

test('inclui histórico da conversa antes da pergunta atual, na ordem', () => {
  const chunks = [retrievedChunk('c1', 0, 'Trecho relevante.', 1)];

  const messages = buildDocumentChatMessages({
    documentName: 'Contrato ACME.pdf',
    chunks,
    history: [
      { role: 'user', content: 'Quem são as partes?' },
      { role: 'assistant', content: 'ACME e Beta Ltda.' },
    ],
    question: 'E a vigência?',
  });

  assert.equal(messages.length, 4);
  assert.deepEqual(
    messages.slice(1).map((m) => m.role),
    ['user', 'assistant', 'user'],
  );
  assert.equal(messages[1].content, 'Quem são as partes?');
  assert.equal(messages[2].content, 'ACME e Beta Ltda.');
  assert.equal(messages[3].content, 'E a vigência?');
});
