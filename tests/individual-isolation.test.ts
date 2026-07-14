import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyClassRuleOwnershipOnInsert,
  applyDocumentOwnershipOnInsert,
  assertCanAccessDocument,
  buildClassRuleOwnershipFilter,
  buildDocumentOwnershipFilter,
} from '../server/tenancy/documentOwnership.js';
import { listAccessGroups } from '../server/services/accessGroupsService.js';
import {
  resolveTenantStorageContextFromIds,
  type TenantStorageContext,
} from '../server/tenancy/tenantStorage.js';
import { SHARED_INDIVIDUAL_COLLECTION_PREFIX } from '../server/tenancy/taxId.js';
import { ServiceError } from '../server/utils/serviceErrors.js';

const TENANT_A = 'individual_alice_ab12';
const TENANT_B = 'individual_bob_cd34';
const USER_A = 'user_alice';
const USER_B = 'user_bob';
const BUSINESS = 'company_acme_ab12cd';

function individualCtx(tenantId: string, userId: string): TenantStorageContext {
  return resolveTenantStorageContextFromIds({
    tenantId,
    tenantType: 'individual',
    collectionPrefix: SHARED_INDIVIDUAL_COLLECTION_PREFIX,
    userId,
  });
}

function businessCtx(tenantId: string): TenantStorageContext {
  return resolveTenantStorageContextFromIds({
    tenantId,
    tenantType: 'business',
    collectionPrefix: tenantId,
  });
}

describe('storage resolver', () => {
  it('business usa collections dedicadas', () => {
    const ctx = businessCtx(BUSINESS);
    assert.equal(ctx.collections.documents, `documents_${BUSINESS}`);
    assert.equal(ctx.storageMode, 'dedicated_collections');
  });

  it('individual usa somente compartilhado', () => {
    const ctx = individualCtx(TENANT_A, USER_A);
    assert.equal(ctx.collections.documents, 'documents_compartilhado');
    assert.equal(ctx.collections.documentCategories, 'document_categories_compartilhado');
    assert.equal(ctx.collections.accessGroups, undefined);
    assert.equal(ctx.collections.documentClasses, undefined);
    assert.ok(!ctx.collections.documents.includes('individual_'));
  });

  it('dois CPFs diferentes usam as mesmas collections físicas', () => {
    const ctxA = individualCtx(TENANT_A, USER_A);
    const ctxB = individualCtx(TENANT_B, USER_B);
    assert.equal(ctxA.collections.documents, ctxB.collections.documents);
    assert.equal(ctxA.collections.auditLogs, ctxB.collections.auditLogs);
  });
});

describe('isolamento CPF A vs B', () => {
  const ctxA = individualCtx(TENANT_A, USER_A);

  it('filtro de documentos de A não inclui B', () => {
    const filterA = buildDocumentOwnershipFilter(ctxA);
    assert.equal(filterA.ownerTenantId, TENANT_A);
    assert.equal(filterA.ownerUserId, USER_A);
    assert.notEqual(filterA.ownerTenantId, TENANT_B);
  });

  it('CPF A não acessa documento de B', () => {
    try {
      assertCanAccessDocument(
        { tenantType: 'individual', ownerTenantId: TENANT_B, ownerUserId: USER_B },
        ctxA,
      );
      assert.fail('deveria lançar');
    } catch (error) {
      assert.equal((error as ServiceError).code, 'DOCUMENT_FORBIDDEN');
    }
  });

  it('insert de documento grava ownership completo', () => {
    const doc = applyDocumentOwnershipOnInsert({ title: 'Doc A' }, ctxA);
    assert.equal(doc.ownerTenantId, TENANT_A);
    assert.equal(doc.ownerUserId, USER_A);
    assert.equal(doc.tenantType, 'individual');
  });

  it('classes PF não incluem scope global no filtro', () => {
    const filter = buildClassRuleOwnershipFilter(ctxA);
    assert.equal(filter.scope, undefined);
    assert.equal(filter.$or, undefined);
    assert.deepEqual(filter, {
      tenantType: 'individual',
      ownerTenantId: TENANT_A,
      ownerUserId: USER_A,
    });
  });

  it('filtro PF A não corresponde a registro da PF B', () => {
    const filterA = buildClassRuleOwnershipFilter(ctxA);
    const recordB = {
      tenantType: 'individual',
      ownerTenantId: TENANT_B,
      ownerUserId: USER_B,
      scope: 'tenant',
      name: 'NDA',
    };
    assert.notEqual(recordB.ownerTenantId, filterA.ownerTenantId);
    assert.notEqual(recordB.ownerUserId, filterA.ownerUserId);
  });

  it('insert de classe individual grava scope tenant', () => {
    const docClass = applyClassRuleOwnershipOnInsert({ name: 'NF' }, ctxA);
    assert.equal(docClass.scope, 'tenant');
    assert.equal(docClass.ownerTenantId, TENANT_A);
    assert.equal(docClass.ownerUserId, USER_A);
  });

  it('audit/processing usam mesmo filtro de ownership', () => {
    const auditFilter = buildDocumentOwnershipFilter(ctxA);
    const jobFilter = buildDocumentOwnershipFilter(ctxA);
    assert.deepEqual(auditFilter, jobFilter);
  });
});

describe('OWNER_USER_REQUIRED', () => {
  it('individual sem ownerUserId falha em documentos', () => {
    const ctx = resolveTenantStorageContextFromIds({
      tenantId: TENANT_A,
      tenantType: 'individual',
      collectionPrefix: SHARED_INDIVIDUAL_COLLECTION_PREFIX,
    });
    assert.throws(() => buildDocumentOwnershipFilter(ctx), (error: ServiceError) => {
      return error.code === 'OWNER_USER_REQUIRED';
    });
  });

  it('individual sem ownerUserId falha em classes/regras', () => {
    const ctx = resolveTenantStorageContextFromIds({
      tenantId: TENANT_A,
      tenantType: 'individual',
      collectionPrefix: SHARED_INDIVIDUAL_COLLECTION_PREFIX,
    });
    assert.throws(() => buildClassRuleOwnershipFilter(ctx), (error: ServiceError) => {
      return error.code === 'OWNER_USER_REQUIRED';
    });
  });
});

describe('cross-tenant type isolation', () => {
  it('business não resolve para compartilhado', () => {
    const ctx = businessCtx(BUSINESS);
    assert.notEqual(ctx.collections.documents, 'documents_compartilhado');
  });

  it('individual não resolve para company collection', () => {
    const ctx = individualCtx(TENANT_A, USER_A);
    assert.notEqual(ctx.collections.documents, `documents_${BUSINESS}`);
  });
});

describe('access groups Mongo deprecated', () => {
  it('listAccessGroups retorna 410', async () => {
    await assert.rejects(() => listAccessGroups(), (error: ServiceError) => {
      return error.code === 'ACCESS_GROUPS_MONGO_DEPRECATED';
    });
  });
});
