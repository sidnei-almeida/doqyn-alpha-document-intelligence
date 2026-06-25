import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isSafeTenantIdentifier } from '../server/utils/tenantId.js';
import { isUnsafeCollectionPrefix } from '../server/tenancy/collectionGuard.js';

describe('tenant provisioning helpers', () => {
  it('aceita tenantId seguro', () => {
    assert.equal(isSafeTenantIdentifier('company_acme_ltda_7f3a2'), true);
  });

  it('rejeita CNPJ como prefixo', () => {
    assert.equal(isUnsafeCollectionPrefix('12345678000199'), true);
    assert.equal(isSafeTenantIdentifier('12345678000199'), false);
  });

  it('rejeita caracteres perigosos', () => {
    assert.equal(isSafeTenantIdentifier('Company-UPPER'), false);
    assert.equal(isSafeTenantIdentifier(''), false);
  });
});
