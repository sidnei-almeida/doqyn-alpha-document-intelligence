import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SECURITY_ACTION_PATTERNS, resolveAuditSeverity } from '../server/services/auditService.ts';
import {
  buildAuditEventsQuery,
  dedupeAuditEvents,
  isAuditAdmin,
  resolveEventFiltersForTab,
  sanitizeAuditMetadataForDisplay,
} from '../src/features/audit/utils/auditDisplay.ts';
import {
  maskEmail,
  sanitizeRejectionReason,
} from '../server/utils/maskSensitiveData.ts';

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
      category: 'security',
    });

    assert.equal(params.q, 'upload');
    assert.equal(params.severity, 'error');
    assert.equal(params.category, 'security');
    assert.equal('tenantId' in params, false);
  });

  it('resolveEventFiltersForTab aplica categoria de segurança', () => {
    const securityFilters = resolveEventFiltersForTab('security', {
      q: 'blocked',
      type: 'USER_BLOCKED',
    });
    assert.equal(securityFilters.category, 'security');
    assert.equal(securityFilters.type, undefined);
    assert.equal(securityFilters.q, 'blocked');
  });

  it('resolveEventFiltersForTab limpa filtros avançados em Todos', () => {
    const allFilters = resolveEventFiltersForTab('all', {
      q: 'teste',
      severity: 'error',
      type: 'USER_APPROVED',
      from: '2025-01-01',
    });
    assert.equal(allFilters.q, undefined);
    assert.equal(allFilters.severity, undefined);
    assert.equal(allFilters.from, '2025-01-01');
  });

  it('dedupeAuditEvents remove duplicatas por id', () => {
    const events = dedupeAuditEvents([
      { id: 'a', action: 'USER_APPROVED', description: '1', severity: 'success', source: 'user', tenantId: 't1', createdAt: '2025-01-01' },
      { id: 'a', action: 'USER_APPROVED', description: '2', severity: 'success', source: 'user', tenantId: 't1', createdAt: '2025-01-01' },
      { id: 'b', action: 'USER_REJECTED', description: '3', severity: 'critical', source: 'user', tenantId: 't1', createdAt: '2025-01-02' },
    ]);
    assert.equal(events.length, 2);
  });

  it('resolveAuditSeverity classifica ações críticas', () => {
    assert.equal(resolveAuditSeverity('USER_REJECTED', 'success'), 'critical');
    assert.equal(resolveAuditSeverity('document.created', 'error'), 'error');
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
    assert.match(String((safe.nested as { note: string }).note), /\[redigido\]/);
  });

  it('SECURITY_ACTION_PATTERNS cobre eventos administrativos sensíveis', () => {
    assert.match(SECURITY_ACTION_PATTERNS.join('|'), /USER_REJECTED/);
    assert.match(SECURITY_ACTION_PATTERNS.join('|'), /password/);
  });
});

describe('membership decision helpers', () => {
  it('sanitizeRejectionReason exige motivo e limita tamanho', () => {
    assert.throws(() => sanitizeRejectionReason('   '), /REJECTION_REASON_REQUIRED/);
    assert.equal(sanitizeRejectionReason('  Perfil inválido  '), 'Perfil inválido');
    assert.equal(sanitizeRejectionReason('x'.repeat(600)).length, 500);
  });

  it('maskEmail mascara endereço sem expor completo', () => {
    assert.equal(maskEmail('admin@empresa.com'), 'ad***@empresa.com');
    assert.equal(maskEmail(undefined), undefined);
  });
});
