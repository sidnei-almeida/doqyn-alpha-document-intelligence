import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyDocumentOwnershipOnInsert,
  assertCanAccessDocument,
  buildClassRuleOwnershipFilter,
  buildDocumentOwnershipFilter,
} from '../server/tenancy/documentOwnership.js';
import {
  resolveTenantStorageContextFromIds,
  type TenantStorageContext,
} from '../server/tenancy/tenantStorage.js';
import { SHARED_INDIVIDUAL_COLLECTION_PREFIX } from '../server/tenancy/taxId.js';
import { ServiceError } from '../server/utils/serviceErrors.js';

describe('tenant storage resolver', () => {
  it('business usa collections dedicadas com tenantId como prefixo', () => {
    const ctx = resolveTenantStorageContextFromIds({
      tenantId: 'company_acme_ab12cd',
      tenantType: 'business',
      collectionPrefix: 'company_acme_ab12cd',
    });

    assert.equal(ctx.storageMode, 'dedicated_collections');
    assert.equal(ctx.collections.documents, 'documents_company_acme_ab12cd');
    assert.equal(ctx.collections.auditLogs, 'audit_logs_company_acme_ab12cd');
  });

  it('individual usa collections compartilhadas compartilhado', () => {
    const ctx = resolveTenantStorageContextFromIds({
      tenantId: 'individual_maria_ab12cd',
      tenantType: 'individual',
      collectionPrefix: SHARED_INDIVIDUAL_COLLECTION_PREFIX,
    });

    assert.equal(ctx.storageMode, 'shared_individual_collection');
    assert.equal(ctx.collectionPrefix, 'compartilhado');
    assert.equal(ctx.collections.documents, 'documents_compartilhado');
    assert.equal(ctx.collections.documentVersions, 'document_versions_compartilhado');
    assert.equal(ctx.collections.processingJobs, 'processing_jobs_compartilhado');
    assert.equal(ctx.collections.auditLogs, 'audit_logs_compartilhado');
    assert.equal(ctx.collections.documents.includes('individual_maria'), false);
  });
});

describe('document ownership filters', () => {
  const businessCtx: TenantStorageContext = resolveTenantStorageContextFromIds({
    tenantId: 'company_acme_ab12cd',
    tenantType: 'business',
  });

  const individualCtx: TenantStorageContext = resolveTenantStorageContextFromIds({
    tenantId: 'individual_a_ab12',
    tenantType: 'individual',
    userId: 'user_a',
  });

  it('business inclui docs canônicos e legados em coleção dedicada', () => {
    const filter = buildDocumentOwnershipFilter(businessCtx);
    assert.ok(filter.$or);
    const branches = filter.$or as Array<Record<string, unknown>>;
    assert.deepEqual(branches[0], { tenantId: 'company_acme_ab12cd' });
    assert.ok(
      branches.some(
        (branch) =>
          branch.tenantId &&
          typeof branch.tenantId === 'object' &&
          '$exists' in (branch.tenantId as Record<string, unknown>),
      ),
    );
  });

  it('individual exige ownerTenantId e ownerUserId', () => {
    const filter = buildDocumentOwnershipFilter(individualCtx);
    assert.deepEqual(filter, {
      tenantType: 'individual',
      ownerTenantId: 'individual_a_ab12',
      ownerUserId: 'user_a',
    });
  });

  it('individual sem userId lança OWNER_USER_REQUIRED', () => {
    const ctx = resolveTenantStorageContextFromIds({
      tenantId: 'individual_a_ab12',
      tenantType: 'individual',
      collectionPrefix: SHARED_INDIVIDUAL_COLLECTION_PREFIX,
    });
    assert.throws(() => buildDocumentOwnershipFilter(ctx), (e: ServiceError) => e.code === 'OWNER_USER_REQUIRED');
  });

  it('classes PF usam ownership estrito sem scope global', () => {
    const filter = buildClassRuleOwnershipFilter(individualCtx);
    assert.deepEqual(filter, {
      tenantType: 'individual',
      ownerTenantId: 'individual_a_ab12',
      ownerUserId: 'user_a',
    });
    assert.equal(JSON.stringify(filter).includes('global'), false);
  });

  it('insert individual grava campos de ownership', () => {
    const doc = applyDocumentOwnershipOnInsert({ title: 'Doc A' }, individualCtx);
    assert.equal(doc.tenantType, 'individual');
    assert.equal(doc.ownerTenantId, 'individual_a_ab12');
    assert.equal(doc.ownerUserId, 'user_a');
  });

  it('pessoa A não acessa documento de pessoa B', () => {
    try {
      assertCanAccessDocument(
        {
          tenantType: 'individual',
          ownerTenantId: 'individual_b_ab12',
          ownerUserId: 'user_b',
        },
        individualCtx,
      );
      assert.fail('deveria lançar DOCUMENT_FORBIDDEN');
    } catch (error) {
      assert.equal((error as { code?: string }).code, 'DOCUMENT_FORBIDDEN');
    }
  });

  it('pessoa A acessa próprio documento', () => {
    assert.doesNotThrow(() =>
      assertCanAccessDocument(
        {
          tenantType: 'individual',
          ownerTenantId: 'individual_a_ab12',
          ownerUserId: 'user_a',
        },
        individualCtx,
      ),
    );
  });
});
