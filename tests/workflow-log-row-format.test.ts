import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatWorkflowLogDuration,
  sanitizeWorkflowDebugDetails,
} from '../src/features/document-send/utils/workflowLogRowFormat.js';

describe('workflowLogRowFormat', () => {
  it('formata duração em ms e segundos', () => {
    assert.equal(formatWorkflowLogDuration(450), '450ms');
    assert.equal(formatWorkflowLogDuration(2500), '2,5s');
    assert.equal(formatWorkflowLogDuration('x'), null);
  });

  it('sanitiza payload de debug com allowlist', () => {
    const sanitized = sanitizeWorkflowDebugDetails(
      {
        durationMs: 1200,
        storageProvider: 'cloudflare_r2',
        objectKey: 'documents/doc_001/versions/ver_001/original/Contrato.pdf',
        GROQ_API_KEY: 'secret',
        requestId: 'req-hidden',
      },
      false,
    );

    assert.equal(sanitized.durationMs, '1,2s');
    assert.equal(sanitized.storageProvider, 'cloudflare_r2');
    assert.ok(sanitized.objectKey?.includes('…'));
    assert.equal(sanitized.GROQ_API_KEY, undefined);
    assert.equal(sanitized.requestId, undefined);
  });

  it('mostra requestId em modo debug', () => {
    const sanitized = sanitizeWorkflowDebugDetails(
      { requestId: 'req-123', endpoint: '/api/documents/analyze-pdf' },
      true,
    );

    assert.equal(sanitized.requestId, 'req-123');
    assert.equal(sanitized.endpoint, '/api/documents/analyze-pdf');
  });
});
