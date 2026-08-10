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
  it('business usa as coleções compartilhadas, sem prefixo por tenant', () => {
    const ctx = resolveTenantStorageContextFromIds({
      tenantId: 'company_acme_ab12cd',
      tenantType: 'business',
      collectionPrefix: 'company_acme_ab12cd',
    });

    assert.equal(ctx.storageMode, 'shared_collections');
    assert.equal(ctx.collections.documents, 'documents');
    assert.equal(ctx.collections.auditLogs, 'audit_logs');
    // O nome da coleção não pode mais carregar o tenant: era isso que criava 53 namespaces
    // por tenant e batia no teto do Atlas por volta de 49 tenants.
    assert.equal(ctx.collections.documents.includes('company_acme'), false);
  });

  it('individual usa exatamente as mesmas coleções que business', () => {
    const ctx = resolveTenantStorageContextFromIds({
      tenantId: 'individual_maria_ab12cd',
      tenantType: 'individual',
      collectionPrefix: SHARED_INDIVIDUAL_COLLECTION_PREFIX,
    });

    assert.equal(ctx.storageMode, 'shared_individual_collection');
    assert.equal(ctx.collections.documents, 'documents');
    assert.equal(ctx.collections.documentVersions, 'document_versions');
    assert.equal(ctx.collections.processingJobs, 'processing_jobs');
    assert.equal(ctx.collections.auditLogs, 'audit_logs');
    assert.equal(ctx.collections.documents.includes('individual_maria'), false);
  });

  it('tenants diferentes resolvem para as mesmas coleções', () => {
    const a = resolveTenantStorageContextFromIds({
      tenantId: 'company_a_ab12cd',
      tenantType: 'business',
    });
    const b = resolveTenantStorageContextFromIds({
      tenantId: 'company_b_ef34gh',
      tenantType: 'business',
    });

    // Provisionar tenant novo não pode mais criar namespace.
    assert.deepEqual(a.collections, b.collections);
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

  it('business filtra estritamente por tenantId, sem ramo para doc sem dono', () => {
    const filter = buildDocumentOwnershipFilter(businessCtx);
    assert.deepEqual(filter, {
      $or: [{ tenantId: 'company_acme_ab12cd' }, { companyId: 'company_acme_ab12cd' }],
    });

    // O ramo `{ tenantId: { $exists: false } }` era inofensivo em coleção dedicada e vira
    // vazamento entre tenants em coleção compartilhada: todo tenant enxergaria todo documento
    // sem dono.
    assert.equal(JSON.stringify(filter).includes('$exists'), false);
  });

  it('documento sem tenantId não é acessível por ninguém', () => {
    assert.throws(
      () => assertCanAccessDocument({ title: 'órfão' }, businessCtx),
      (e: ServiceError) => e.code === 'DOCUMENT_FORBIDDEN',
    );
  });

  it('business não alcança documento de outro tenant', () => {
    assert.throws(
      () => assertCanAccessDocument({ tenantId: 'company_outro_zz99' }, businessCtx),
      (e: ServiceError) => e.code === 'DOCUMENT_FORBIDDEN',
    );
  });

  it('individual lidera por tenantId e ainda exige ownerUserId', () => {
    const filter = buildDocumentOwnershipFilter(individualCtx);
    // Liderar por tenantId é o que faz a consulta usar os índices da coleção compartilhada.
    assert.deepEqual(filter, {
      tenantId: 'individual_a_ab12',
      tenantType: 'individual',
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
      tenantId: 'individual_a_ab12',
      tenantType: 'individual',
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
