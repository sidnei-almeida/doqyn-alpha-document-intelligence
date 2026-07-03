import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canViewDocumentTracking, assertTrackingTenantScope } from '../server/auth/permissions.js';
import { buildTrackingEventsQuery } from '../src/features/tracking/utils/trackingDisplay.ts';
import { canViewDocumentTracking as canViewTrackingFrontend } from '../src/features/tracking/utils/trackingAccess.ts';
import type { AuthUser } from '../server/auth/types.js';
import { ServiceError } from '../server/utils/serviceErrors.js';

function adminUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user_admin',
    email: 'admin@example.com',
    name: 'Admin',
    companyId: 'company_a',
    tenantId: 'company_a',
    companyName: 'Empresa A',
    role: 'admin',
    area: 'TI',
    groups: [],
    platformRoles: ['company_admin'],
    membershipStatus: 'active',
    ...overrides,
  };
}

describe('canViewDocumentTracking backend', () => {
  it('permite company_admin ativo', () => {
    assert.equal(canViewDocumentTracking(adminUser()), true);
  });

  it('permite doqyn_admin', () => {
    assert.equal(
      canViewDocumentTracking(adminUser({ platformRoles: ['doqyn_admin'], role: 'admin' })),
      true,
    );
  });

  it('permite individual_admin', () => {
    assert.equal(
      canViewDocumentTracking(
        adminUser({ platformRoles: ['individual_admin'], tenantType: 'individual' }),
      ),
      true,
    );
  });

  it('nega usuário comum', () => {
    assert.equal(
      canViewDocumentTracking(adminUser({ platformRoles: ['user'], role: 'user' })),
      false,
    );
  });

  it('nega membership bloqueada', () => {
    assert.equal(
      canViewDocumentTracking(adminUser({ membershipStatus: 'blocked' })),
      false,
    );
  });
});

describe('assertTrackingTenantScope', () => {
  it('company_admin não pode consultar outro tenant', () => {
    assert.throws(
      () => assertTrackingTenantScope(adminUser(), 'company_a', 'company_b'),
      (error: unknown) =>
        error instanceof ServiceError && error.code === 'TENANT_SCOPE_FORBIDDEN',
    );
  });

  it('doqyn_admin pode consultar outro tenant via query', () => {
    assert.doesNotThrow(() =>
      assertTrackingTenantScope(
        adminUser({ platformRoles: ['doqyn_admin'] }),
        'company_a',
        'company_b',
      ),
    );
  });
});

describe('tracking frontend access', () => {
  it('menu Tracking visível para company_admin', () => {
    assert.equal(canViewTrackingFrontend(['company_admin']), true);
  });

  it('menu Tracking visível para doqyn_admin', () => {
    assert.equal(canViewTrackingFrontend(['doqyn_admin']), true);
  });

  it('menu Tracking oculto para user comum', () => {
    assert.equal(canViewTrackingFrontend(['user']), false);
  });
});

describe('buildTrackingEventsQuery', () => {
  it('monta query sem tenantId do frontend', () => {
    const params = buildTrackingEventsQuery({
      q: 'upload',
      documentId: 'doc_1',
      category: 'analysis',
      severity: 'error',
    });
    assert.equal(params.q, 'upload');
    assert.equal(params.documentId, 'doc_1');
    assert.equal(params.category, 'analysis');
    assert.equal(params.severity, 'error');
    assert.equal('tenantId' in params, false);
  });
});
