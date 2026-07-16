import { strict as assert } from 'node:assert';
import test from 'node:test';
import { confirmAnalysisSchema } from '../server/services/confirmAnalysisService.js';

function basePayload() {
  return {
    jobId: 'job_test',
    originalFileName: 'contrato.pdf',
    fileHash: 'a'.repeat(64),
    fileSizeBytes: 1024,
    textExtraction: { status: 'completed', pageCount: 2, charCount: 500, truncated: false },
    classification: {
      classId: 'cat_x',
      className: 'Contrato',
      confidence: 0.9,
      requiresReview: false,
      reason: 'ok',
      evidence: [{ pageNumber: 1, snippet: 'trecho' }],
    },
    extraction: {
      documentType: 'Contrato',
      version: 'v1.0',
      metadata: {
        data_validade: {
          label: 'Data de validade',
          value: '2027-01-01',
          confidence: 0.8,
          evidence: { pageNumber: 1, snippet: 'válido até' },
        },
      },
      missingFields: [],
      requiresReview: false,
      reviewReasons: [],
    },
    logs: [],
  };
}

test('confirmAnalysisSchema aceita payload com evidence completa', () => {
  const parsed = confirmAnalysisSchema.safeParse(basePayload());
  assert.equal(parsed.success, true);
});

test('confirmAnalysisSchema aceita evidence.pageNumber null (Mongo converte undefined em null no job assíncrono)', () => {
  const payload = basePayload();
  payload.extraction.metadata.data_validade.evidence = {
    pageNumber: null as unknown as number,
    snippet: 'válido até',
  };
  payload.classification.evidence = [
    { pageNumber: null as unknown as number, snippet: 'trecho' },
  ];
  const parsed = confirmAnalysisSchema.safeParse(payload);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.extraction.metadata.data_validade.evidence?.pageNumber, undefined);
    assert.equal(parsed.data.classification.evidence[0]?.pageNumber, undefined);
  }
});
