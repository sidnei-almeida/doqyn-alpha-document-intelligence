import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveTenantTaxIdentity } from '../server/services/tenantProvisionService.js';

describe('provisionamento grava o documento fiscal que o auth validou', () => {
  it('empresa de fora do Brasil não vira CNPJ', () => {
    assert.deepEqual(
      resolveTenantTaxIdentity({ tenantType: 'business', country: 'us', taxIdType: 'ein' }),
      { country: 'US', taxIdType: 'EIN', taxIdMasked: '****' },
    );
  });

  it('pessoa física do Paraguai não vira CPF', () => {
    const identity = resolveTenantTaxIdentity({
      tenantType: 'individual',
      country: 'PY',
      taxIdType: 'ruc',
    });
    assert.equal(identity.taxIdType, 'RUC');
    assert.equal(identity.taxIdMasked, '****');
  });

  it('Brasil mantém tipo e máscara brasileiros', () => {
    assert.deepEqual(
      resolveTenantTaxIdentity({ tenantType: 'business', country: 'BR', taxIdType: 'cnpj' }),
      { country: 'BR', taxIdType: 'CNPJ', taxIdMasked: '**.***.***/****-**' },
    );
  });

  it('sem country vale o contrato antigo: BR, tipo pelo tenantType', () => {
    assert.deepEqual(resolveTenantTaxIdentity({ tenantType: 'individual' }), {
      country: 'BR',
      taxIdType: 'CPF',
      taxIdMasked: '***.***.***-**',
    });
  });

  it('país de fora sem tipo é recusado, em vez de cair em CPF/CNPJ', () => {
    assert.throws(
      () => resolveTenantTaxIdentity({ tenantType: 'business', country: 'ES' }),
      (error: unknown) => (error as { code?: string }).code === 'INVALID_TAX_ID_TYPE',
    );
  });

  it('country fora do formato ISO é recusado', () => {
    assert.throws(
      () => resolveTenantTaxIdentity({ tenantType: 'business', country: 'Brasil', taxIdType: 'cnpj' }),
      (error: unknown) => (error as { code?: string }).code === 'INVALID_COUNTRY',
    );
  });
});
