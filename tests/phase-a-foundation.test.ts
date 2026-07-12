import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveAnalysisProvider, resolveAnalysisProviderName } from '../server/ai/providers/resolveAnalysisProvider.js';
import { groqDocumentAnalysisProvider } from '../server/ai/providers/groqDocumentAnalysisProvider.js';
import { googleVisionDocumentAnalysisProvider } from '../server/ai/providers/googleVisionDocumentAnalysisProvider.js';
import { isAnalysisSyncFallbackEnabled } from '../server/queues/analysisQueue.js';

describe('Fase A — providers e fila', () => {
  it('resolveAnalysisProvider usa Groq por padrão', () => {
    const original = process.env.DOCUMENT_ANALYSIS_PROVIDER;
    delete process.env.DOCUMENT_ANALYSIS_PROVIDER;

    try {
      assert.equal(resolveAnalysisProviderName(), 'groq');
      assert.equal(resolveAnalysisProvider(), groqDocumentAnalysisProvider);
    } finally {
      if (original !== undefined) {
        process.env.DOCUMENT_ANALYSIS_PROVIDER = original;
      }
    }
  });

  it('google_vision retorna provider stub não configurado', () => {
    const original = process.env.DOCUMENT_ANALYSIS_PROVIDER;
    process.env.DOCUMENT_ANALYSIS_PROVIDER = 'google_vision';

    try {
      assert.equal(resolveAnalysisProviderName(), 'google_vision');
      assert.equal(resolveAnalysisProvider(), googleVisionDocumentAnalysisProvider);
      assert.equal(googleVisionDocumentAnalysisProvider.isConfigured(), false);
    } finally {
      if (original !== undefined) {
        process.env.DOCUMENT_ANALYSIS_PROVIDER = original;
      } else {
        delete process.env.DOCUMENT_ANALYSIS_PROVIDER;
      }
    }
  });

  it('ANALYSIS_SYNC_FALLBACK default é true fora de produção', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalFallback = process.env.ANALYSIS_SYNC_FALLBACK;
    process.env.NODE_ENV = 'development';
    delete process.env.ANALYSIS_SYNC_FALLBACK;

    try {
      assert.equal(isAnalysisSyncFallbackEnabled(), true);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      if (originalFallback !== undefined) {
        process.env.ANALYSIS_SYNC_FALLBACK = originalFallback;
      }
    }
  });
});
