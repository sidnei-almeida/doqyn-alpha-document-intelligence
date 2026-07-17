import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCompanySignupPayload,
  buildCompanySignupReviewSections,
  validateCompanySignupForm,
} from '../src/features/company-signup/companySignupReview';
import { DOQYN_TERMS_VERSION } from '../src/legal/terms';
import { PASSWORD_REVIEW_LABEL } from '../src/lib/reviewDisplay';

const validForm = {
  companyName: 'Alpha Consultoria',
  country: 'BR' as const,
  taxId: '12.345.678/0001-99',
  firstName: 'Maria',
  lastName: 'Santos',
  email: 'maria@alpha.com',
  whatsapp: '+55 (11) 98888-7777',
  password: 'senha-segura-123',
  confirmPassword: 'senha-segura-123',
  acceptedTerms: true,
  companyAuthorization: true,
};

describe('company signup review flow', () => {
  it('bloqueia sem aceite dos termos', () => {
    const result = validateCompanySignupForm({ ...validForm, acceptedTerms: false });
    assert.equal(result.valid, false);
    assert.equal(result.field, 'acceptedTerms');
  });

  it('seções de revisão mostram versão dos termos', () => {
    const sections = buildCompanySignupReviewSections(validForm);
    const serialized = JSON.stringify(sections);

    assert.equal(serialized.includes(DOQYN_TERMS_VERSION), true);
    assert.equal(serialized.includes(PASSWORD_REVIEW_LABEL), true);
  });

  it('payload de envio inclui aceite e versão', () => {
    const payload = buildCompanySignupPayload(validForm);
    assert.equal(payload.acceptedTerms, true);
    assert.equal(payload.acceptedTermsVersion, DOQYN_TERMS_VERSION);
  });
});
