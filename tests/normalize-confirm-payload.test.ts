import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AnalyzePdfResponse } from '../src/features/document-send/services/analyzePdf.ts';
import {
  normalizeAnalyzePayloadForConfirm,
  validateConfirmableAnalysis,
} from '../src/features/document-send/services/normalizeConfirmPayload.ts';

function makeAnalyzeResponse(
  overrides: Partial<AnalyzePdfResponse> = {},
): AnalyzePdfResponse {
  return {
    jobId: 'job-1',
    status: 'requires_review',
    originalFileName: 'contrato.pdf',
    fileHash: 'a'.repeat(64),
    fileSizeBytes: 1024,
    recommendedFileName: null,
    textExtraction: { status: 'completed', charCount: 100, truncated: false },
    classification: {
      classId: 'cat-1',
      className: 'Contrato',
      confidence: 0.4,
      requiresReview: true,
      reason: 'Baixa confiança',
      evidence: [],
    },
    extraction: null,
    logs: [],
    ...overrides,
  };
}

describe('normalizeConfirmPayload', () => {
  it('mantém extraction quando já presente', () => {
    const payload = makeAnalyzeResponse({
      extraction: {
        documentType: 'Contrato',
        version: 'v1.0',
        metadata: {},
        missingFields: [],
        requiresReview: false,
        reviewReasons: [],
      },
    });
    assert.deepEqual(normalizeAnalyzePayloadForConfirm(payload).extraction, payload.extraction);
  });

  it('normaliza extraction:null para estrutura mínima aceita pelo schema', () => {
    const normalized = normalizeAnalyzePayloadForConfirm(makeAnalyzeResponse());
    assert.ok(normalized.extraction);
    assert.equal(normalized.extraction?.version, 'v1.0');
    assert.equal(normalized.extraction?.requiresReview, true);
    assert.deepEqual(normalized.extraction?.metadata, {});
  });

  it('validateConfirmableAnalysis exige classId e jobId', () => {
    assert.equal(validateConfirmableAnalysis(makeAnalyzeResponse()), null);
    assert.match(
      validateConfirmableAnalysis(makeAnalyzeResponse({ classification: { ...makeAnalyzeResponse().classification, classId: null } })) ?? '',
      /Classificação ausente/,
    );
    assert.match(
      validateConfirmableAnalysis(makeAnalyzeResponse({ jobId: '' })) ?? '',
      /Identificador da análise/,
    );
  });
});
