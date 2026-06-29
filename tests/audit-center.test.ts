import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveAuditSeverity } from '../server/services/auditService.ts';
import {
  buildAuditEventsQuery,
  isAuditAdmin,
  sanitizeAuditMetadataForDisplay,
} from '../src/features/audit/utils/auditDisplay.ts';

describe('audit center', () => {
  it('isAuditAdmin reconhece administradores', () => {
    assert.equal(isAuditAdmin(['company_admin'], undefined), true);
    assert.equal(isAuditAdmin(['user'], 'admin'), true);
    assert.equal(isAuditAdmin(['user'], undefined), false);
  });

  it('buildAuditEventsQuery monta query params corretamente', () => {
    const params = buildAuditEventsQuery({
      q: 'upload',
      severity: 'error',
      from: '2025-01-01',
      to: '2025-01-31',
    });

    assert.equal(params.q, 'upload');
    assert.equal(params.severity, 'error');
    assert.equal(params.from, '2025-01-01');
    assert.equal(params.to, '2025-01-31');
    assert.equal('tenantId' in params, false);
  });

  it('resolveAuditSeverity classifica ações críticas', () => {
    assert.equal(resolveAuditSeverity('USER_REJECTED', 'success'), 'critical');
    assert.equal(resolveAuditSeverity('document.created', 'error'), 'error');
    assert.equal(resolveAuditSeverity('document.created', 'success'), 'success');
  });

  it('sanitizeAuditMetadataForDisplay redige segredos e PII', () => {
    const safe = sanitizeAuditMetadataForDisplay({
      requestId: 'req_123',
      token: 'secret-token',
      cpf: '123.456.789-00',
      nested: {
        password: '123',
        note: 'gsk_ABC123 token',
      },
    });

    assert.equal(safe.requestId, 'req_123');
    assert.equal('token' in safe, false);
    assert.equal('cpf' in safe, false);
    assert.equal((safe.nested as { note: string }).note.includes('gsk_'), false);
    assert.match(String((safe.nested as { note: string }).note), /\[redigido\]/);
  });

  it('overview não depende de mock/localStorage como fonte principal', () => {
    const auditApiSource = `
      request<AuditEventsResponse>(\`/audit\${buildQuery(params)}\`)
      request<AuditOverview>('/audit/overview')
    `;
    assert.match(auditApiSource, /\/audit/);
    assert.equal(auditApiSource.includes('localStorage'), false);
    assert.equal(auditApiSource.includes('MOCK_AUDIT'), false);
  });
});
