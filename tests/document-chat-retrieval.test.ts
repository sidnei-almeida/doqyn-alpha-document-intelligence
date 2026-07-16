import { strict as assert } from 'node:assert';
import test from 'node:test';
import { retrieveChunksForQuestion } from '../server/services/hybridChunkRetriever.js';
import type { DocumentChunk } from '../server/ai/types/documentAi.types.js';

function chunk(id: string, chunkIndex: number, text: string, pageNumber?: number): DocumentChunk {
  return { id, chunkIndex, text, pageNumber };
}

test('retorna chunks que casam com termos da pergunta, ordenados por score', () => {
  const chunks = [
    chunk('c1', 0, 'Cláusula primeira: o objeto deste contrato é a prestação de serviços.', 1),
    chunk('c2', 1, 'A multa por rescisão antecipada será de R$ 5.000,00.', 2),
    chunk('c3', 2, 'Foro da comarca de São Paulo para dirimir controvérsias.', 3),
  ];
  const result = retrieveChunksForQuestion({
    chunks,
    question: 'Qual o valor da multa por rescisão?',
    topK: 2,
  });
  assert.equal(result.length, 2);
  assert.equal(result[0].id, 'c2');
  assert.ok(result[0].score > 0);
});

test('pergunta sem termos casando cai no fallback (primeiros chunks)', () => {
  const chunks = [
    chunk('c1', 0, 'texto alfa', 1),
    chunk('c2', 1, 'texto beta', 2),
  ];
  const result = retrieveChunksForQuestion({ chunks, question: 'zzzz wwww', topK: 1 });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'c1');
});
