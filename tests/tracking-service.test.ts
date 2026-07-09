import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CLIENT_TRACKING_ACTIONS, resolveTrackingActionGroup, resolveTrackingEventStatus } from '../server/services/tracking/trackingTypes.js';
import { hashTrackingValue, parseUserAgentSummary } from '../server/services/tracking/trackingSecurity.js';
import { sanitizeAuditMetadata } from '../server/utils/sanitizeAuditMetadata.js';
import { ServiceError } from '../server/utils/serviceErrors.js';
import { emitClientTrackingEvent } from '../server/services/tracking/trackingService.js';
import type { DocumentAuditContext } from '../server/audit/documentAuditTypes.js';

const auditCtx: DocumentAuditContext = {
  tenantId: 'tenant_test',
  tenantType: 'business',
  collectionPrefix: 'tenant_test',
  actorUserId: 'user_1',
  actorMembershipId: 'mem_1',
  actorDisplayName: 'Test User',
  actorEmail: 'test@example.com',
  actorRoles: ['admin'],
  requestId: 'req_test',
};

describe('tracking service', () => {
  it('resolveTrackingActionGroup classifica preview e download', () => {
    assert.equal(resolveTrackingActionGroup('document.preview_viewed'), 'preview');
    assert.equal(resolveTrackingActionGroup('document.downloaded'), 'download');
    assert.equal(resolveTrackingActionGroup('access.document_denied'), 'access');
    assert.equal(resolveTrackingActionGroup('file_explorer.search_performed'), 'explorer');
  });

  it('resolveTrackingEventStatus identifica denied e failed', () => {
    assert.equal(resolveTrackingEventStatus('document.download_denied'), 'denied');
    assert.equal(resolveTrackingEventStatus('document.preview_failed'), 'failed');
    assert.equal(resolveTrackingEventStatus('document.downloaded'), 'success');
  });

  it('sanitizeAuditMetadata remove token e secrets', () => {
    const safe = sanitizeAuditMetadata({
      token: 'secret-token',
      authorization: 'Bearer xyz',
      objectKey: 'tenant/doc/file.pdf',
      presignedUrl: 'https://r2.example.com/x',
      requestId: 'req_1',
    });
    assert.equal('token' in safe, false);
    assert.equal('authorization' in safe, false);
    assert.equal('objectKey' in safe, false);
    assert.equal('presignedUrl' in safe, false);
    assert.equal(safe.requestId, 'req_1');
  });

  it('hashTrackingValue produz hash estável', () => {
    const a = hashTrackingValue('192.168.1.1', 'doqyn-ip-v1');
    const b = hashTrackingValue('192.168.1.1', 'doqyn-ip-v1');
    assert.equal(a, b);
    assert.notEqual(a, '192.168.1.1');
  });

  it('parseUserAgentSummary resume user-agent sem expor string completa', () => {
    const summary = parseUserAgentSummary(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    );
    assert.ok(summary);
    assert.ok(!summary.includes('Mozilla/5.0'));
  });

  it('CLIENT_TRACKING_ACTIONS contém eventos do viewer', () => {
    assert.equal(CLIENT_TRACKING_ACTIONS.has('document.viewer_opened'), true);
    assert.equal(CLIENT_TRACKING_ACTIONS.has('document.viewer_closed'), true);
    assert.equal(CLIENT_TRACKING_ACTIONS.has('document.print_attempt_blocked'), true);
    assert.equal(CLIENT_TRACKING_ACTIONS.has('document.downloaded'), false);
  });

  it('emitClientTrackingEvent rejeita ação fora da allowlist', async () => {
    await assert.rejects(
      () =>
        emitClientTrackingEvent(auditCtx, { headers: {} }, {
          action: 'document.downloaded',
        }),
      (error: unknown) => error instanceof ServiceError && error.code === 'TRACKING_ACTION_FORBIDDEN',
    );
  });
});

describe('tracking display helpers', () => {
  it('buildTrackingEventsQuery inclui novos filtros', async () => {
    const { buildTrackingEventsQuery } = await import('../src/features/tracking/utils/trackingDisplay.ts');
    const params = buildTrackingEventsQuery({
      status: 'denied',
      actionGroup: 'access',
      requestId: 'req_abc',
      documentId: 'doc_1',
    });
    assert.equal(params.status, 'denied');
    assert.equal(params.actionGroup, 'access');
    assert.equal(params.requestId, 'req_abc');
    assert.equal(params.documentId, 'doc_1');
  });

  it('formatTrackingStatus traduz status', async () => {
    const { formatTrackingStatus } = await import('../src/features/tracking/utils/trackingDisplay.ts');
    assert.equal(formatTrackingStatus('denied'), 'Negado');
    assert.equal(formatTrackingStatus('success'), 'Sucesso');
  });
});
