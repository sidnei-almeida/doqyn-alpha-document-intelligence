import { strict as assert } from 'node:assert';
import test from 'node:test';
import { selectChunksForQuestion } from '../server/services/retrievalProvider.js';
import type { DocumentChunk } from '../server/ai/types/documentAi.types.js';

function chunk(id: string, chunkIndex: number, text: string, pageNumber?: number): DocumentChunk {
  return { id, chunkIndex, text, pageNumber };
}

test('selectChunksForQuestion delega para o modo hybrid e retorna chunks pontuados', () => {
  const chunks = [
    chunk('c1', 0, 'Cláusula primeira: o objeto deste contrato é a prestação de serviços.', 1),
    chunk('c2', 1, 'A multa por rescisão antecipada será de R$ 5.000,00.', 2),
  ];

  const result = selectChunksForQuestion({
    chunks,
    question: 'Qual o valor da multa?',
    topK: 1,
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'c2');
  assert.ok(result[0].score > 0);
});
