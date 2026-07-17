import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildIndividualSignupPayload,
  validateIndividualSignupForm,
} from '../src/features/individual-signup/individualSignupReview';
import { DOQYN_TERMS_VERSION } from '../src/legal/terms';

const validForm = {
  firstName: 'Ana',
  lastName: 'Lima',
  email: 'ana@email.com',
  whatsapp: '+55 (11) 97777-6666',
  country: 'BR' as const,
  taxId: '123.456.789-01',
  password: 'senha-segura-123',
  confirmPassword: 'senha-segura-123',
  acceptedTerms: true,
};

describe('individual signup review flow', () => {
  it('bloqueia sem aceite dos termos', () => {
    const result = validateIndividualSignupForm({ ...validForm, acceptedTerms: false });
    assert.equal(result.valid, false);
    assert.equal(result.field, 'acceptedTerms');
  });

  it('payload usa aceite e versão dos termos', () => {
    const payload = buildIndividualSignupPayload(validForm);
    assert.equal(payload.acceptedTerms, true);
    assert.equal(payload.acceptedTermsVersion, DOQYN_TERMS_VERSION);
  });
});
