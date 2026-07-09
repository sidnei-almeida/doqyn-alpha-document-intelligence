import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { summarizeWorkflowLogMessage } from '../src/features/document-send/utils/workflowLogHelpers.ts';
import { sanitizeAuditMetadataForDisplay } from '../src/features/audit/utils/auditDisplay.ts';
import { buildTrackingEventsQuery, formatTrackingAction } from '../src/features/tracking/utils/trackingDisplay.ts';

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

describe('tracking page helpers', () => {
  it('buildTrackingEventsQuery serializa filtros de status e grupo', () => {
    const query = buildTrackingEventsQuery({
      status: 'failed',
      actionGroup: 'preview',
      from: '2026-01-01',
    });
    assert.equal(query.status, 'failed');
    assert.equal(query.actionGroup, 'preview');
    assert.equal(query.from, '2026-01-01');
  });

  it('formatTrackingAction usa labels em português', () => {
    assert.equal(formatTrackingAction('document.preview_viewed'), 'Preview visualizado');
    assert.equal(formatTrackingAction('document.download_denied'), 'Download negado');
  });

  it('TrackingSummaryStrip usa cards temáticos sem ícones em fundo preto', () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'features', 'tracking', 'components', 'TrackingSummaryStrip.tsx'),
      'utf8',
    );
    assert.ok(source.includes('border-doqyn-border-subtle'));
    assert.ok(source.includes('bg-doqyn-primary-bg'));
    assert.equal(source.includes('bg-doqyn-bg'), false);
  });
});
