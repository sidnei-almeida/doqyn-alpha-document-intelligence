import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canConfirmDocuments, canViewDocumentTracking } from '../server/auth/permissions.js';
import { userGovernsTenantScope } from '../server/tenancy/documentAccess.js';
import {
  resolveSharedCollections,
  type TenantStorageContext,
} from '../server/tenancy/tenantStorage.js';
import { SHARED_INDIVIDUAL_COLLECTION_PREFIX } from '../server/tenancy/taxId.js';
import { buildTrackingEventsQuery } from '../src/features/tracking/utils/trackingDisplay.ts';
import { canViewDocumentTracking as canViewTrackingFrontend } from '../src/features/tracking/utils/trackingAccess.ts';
import type { AuthUser } from '../server/auth/types.js';

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

/** Usuário comum do mesmo tenant de negócio: sem papel administrativo nenhum. */
function plainUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return adminUser({
    id: 'user_plain',
    email: 'plain@example.com',
    name: 'Comum',
    role: 'user',
    platformRoles: ['user'],
    ...overrides,
  });
}

function businessStorage(overrides: Partial<TenantStorageContext> = {}): TenantStorageContext {
  return {
    tenantId: 'company_a',
    tenantType: 'business',
    storageMode: 'shared_collections',
    collectionPrefix: 'company_a',
    userId: 'user_plain',
    collections: resolveSharedCollections(),
    ...overrides,
  };
}

function individualStorage(overrides: Partial<TenantStorageContext> = {}): TenantStorageContext {
  return {
    tenantId: 'tenant_pf',
    tenantType: 'individual',
    storageMode: 'shared_individual_collection',
    collectionPrefix: SHARED_INDIVIDUAL_COLLECTION_PREFIX,
    userId: 'user_pf',
    collections: resolveSharedCollections(),
    ...overrides,
  };
}

describe('canViewDocumentTracking backend', () => {
  it('permite company_admin ativo (D-01)', () => {
    assert.equal(canViewDocumentTracking(adminUser()), true);
  });

  it('nega o papel de plataforma eliminado, sem escopo de propriedade (D-02)', () => {
    assert.equal(
      canViewDocumentTracking(adminUser({ platformRoles: ['doqyn_admin'], role: 'admin' })),
      false,
    );
  });

  it('nega individual_admin sem escopo — em PF o acesso vem do escopo de tenant, não do papel', () => {
    assert.equal(
      canViewDocumentTracking(
        adminUser({ platformRoles: ['individual_admin'], tenantType: 'individual' }),
      ),
      false,
    );
  });

  it('nega o papel legado manager com platformRoles vazio (D-03)', () => {
    assert.equal(canViewDocumentTracking(adminUser({ platformRoles: [], role: 'manager' })), false);
  });

  it('nega o papel legado admin com platformRoles vazio (D-03)', () => {
    assert.equal(canViewDocumentTracking(adminUser({ platformRoles: [], role: 'admin' })), false);
  });

  it('nega usuário comum sem escopo', () => {
    assert.equal(canViewDocumentTracking(plainUser()), false);
  });

  it('permite o dono ver o tracking do próprio documento (D-07)', () => {
    const user = plainUser();
    assert.equal(canViewDocumentTracking(user, { ownerUserId: user.id }), true);
  });

  it('nega o escopo de documento de terceiro', () => {
    assert.equal(canViewDocumentTracking(plainUser(), { ownerUserId: 'user_outro' }), false);
  });

  it('nega membership bloqueada mesmo sendo company_admin', () => {
    assert.equal(canViewDocumentTracking(adminUser({ membershipStatus: 'blocked' })), false);
  });

  it('nega membership bloqueada mesmo sendo dono do documento', () => {
    const user = plainUser({ membershipStatus: 'blocked' });
    assert.equal(canViewDocumentTracking(user, { ownerUserId: user.id }), false);
  });

  it('nega usuário sem id', () => {
    assert.equal(canViewDocumentTracking(adminUser({ id: '   ' })), false);
  });
});

describe('canConfirmDocuments (D-09)', () => {
  it('permite o dono confirmar metadado do próprio documento', () => {
    const user = plainUser();
    assert.equal(canConfirmDocuments(user, { ownerUserId: user.id }), true);
  });

  it('nega usuário qualquer sobre documento de terceiro', () => {
    assert.equal(canConfirmDocuments(plainUser(), { ownerUserId: 'user_outro' }), false);
  });

  it('permite company_admin sobre documento de terceiro (D-01)', () => {
    assert.equal(canConfirmDocuments(adminUser(), { ownerUserId: 'user_outro' }), true);
  });

  it('nega o papel de plataforma eliminado sobre documento de terceiro (D-02)', () => {
    assert.equal(
      canConfirmDocuments(adminUser({ platformRoles: ['doqyn_admin'] }), {
        ownerUserId: 'user_outro',
      }),
      false,
    );
  });

  it('nega quando não há documento em escopo e o usuário não é company_admin', () => {
    assert.equal(canConfirmDocuments(plainUser()), false);
  });
});

describe('userGovernsTenantScope', () => {
  it('permite o usuário único de um tenant PF no próprio pool (T-01-10)', () => {
    const user = plainUser({ id: 'user_pf', tenantId: 'tenant_pf', tenantType: 'individual' });
    assert.equal(userGovernsTenantScope(user, individualStorage()), true);
  });

  it('nega outro usuário sobre o pool individual alheio', () => {
    const user = plainUser({ id: 'user_intruso', tenantType: 'individual' });
    assert.equal(userGovernsTenantScope(user, individualStorage()), false);
  });

  it('nega usuário comum de tenant de negócio', () => {
    assert.equal(userGovernsTenantScope(plainUser(), businessStorage()), false);
  });

  it('permite company_admin em tenant de negócio (D-01)', () => {
    assert.equal(userGovernsTenantScope(adminUser(), businessStorage()), true);
  });

  it('nega o papel de plataforma eliminado em tenant de negócio (D-02)', () => {
    assert.equal(
      userGovernsTenantScope(adminUser({ platformRoles: ['doqyn_admin'] }), businessStorage()),
      false,
    );
  });
});

describe('tracking frontend access', () => {
  it('menu Tracking visível para company_admin', () => {
    assert.equal(canViewTrackingFrontend(['company_admin']), true);
  });

  it('menu Tracking oculto para o papel de plataforma eliminado (D-02)', () => {
    assert.equal(canViewTrackingFrontend(['doqyn_admin']), false);
  });

  it('menu Tracking visível para o usuário de tenant PF', () => {
    assert.equal(canViewTrackingFrontend(['individual_admin']), true);
  });

  it('menu Tracking oculto para o papel legado sem platformRoles (D-03)', () => {
    assert.equal(canViewTrackingFrontend([], 'manager'), false);
  });

  it('menu Tracking oculto para user comum', () => {
    assert.equal(canViewTrackingFrontend(['user']), false);
  });

  it('menu Tracking oculto para membership não ativa', () => {
    assert.equal(canViewTrackingFrontend(['company_admin'], 'admin', 'blocked'), false);
  });
});

describe('buildTrackingEventsQuery', () => {
  it('monta query sem tenantId do frontend (D-08)', () => {
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
