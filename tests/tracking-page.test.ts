import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { summarizeWorkflowLogMessage } from '../src/features/document-send/utils/workflowLogHelpers.ts';
import { sanitizeAuditMetadataForDisplay } from '../src/features/audit/utils/auditDisplay.ts';

describe('workflow logs minimalistas', () => {
  it('summarizeWorkflowLogMessage prioriza friendlyTitle', () => {
    const message = summarizeWorkflowLogMessage({
      level: 'success',
      stage: 'analysis',
      message: 'document.analysis_completed internal',
      details: { friendlyTitle: 'Análise concluída — revise os metadados sugeridos.' },
    });
    assert.equal(message, 'Análise concluída — revise os metadados sugeridos.');
  });

  it('tracking metadata display redige segredos', () => {
    const safe = sanitizeAuditMetadataForDisplay({
      token: 'secret',
      requestId: 'req_1',
      changes: [{ field: 'valor', before: '10', after: '12' }],
    });
    assert.equal('token' in safe, false);
    assert.equal(safe.requestId, 'req_1');
  });
});
