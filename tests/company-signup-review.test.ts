import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCompanySignupPayload,
  buildCompanySignupReviewSections,
  validateCompanySignupForm,
} from '../src/features/company-signup/companySignupReview';
import { DOQYN_TERMS_VERSION } from '../src/legal/terms';
import { PASSWORD_REVIEW_LABEL_KEY } from '../src/lib/reviewDisplay';
import { echoT } from './helpers/i18nForTests.ts';

const validForm = {
  companyName: 'Alpha Consultoria',
  // O país entrou no formulário depois que o cadastro passou a validar documento e telefone por
  // país; a fixture ficou para trás e a revisão estourava no rótulo "País".
  country: 'BR',
  taxId: '11.222.333/0001-81',
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
  it('aceita CNPJ numérico e alfanumérico com dígito certo', () => {
    assert.equal(validateCompanySignupForm(validForm).valid, true);
    assert.equal(
      validateCompanySignupForm({ ...validForm, taxId: '12.ABC.345/01DE-35' }).valid,
      true,
    );
  });

  it('bloqueia CNPJ com dígito verificador errado antes de enviar', () => {
    const result = validateCompanySignupForm({ ...validForm, taxId: '12.345.678/0001-99' });
    assert.equal(result.valid, false);
  });

  it('bloqueia sem aceite dos termos', () => {
    const result = validateCompanySignupForm({ ...validForm, acceptedTerms: false });
    assert.equal(result.valid, false);
    assert.equal(result.field, 'acceptedTerms');
  });

  it('seções de revisão mostram versão dos termos', () => {
    /* `t` de eco: o que este teste verifica é a estrutura — que a versão dos termos chega
       interpolada e que a seção de senha aparece — e não a frase, que é assunto do catálogo. */
    const sections = buildCompanySignupReviewSections(validForm, echoT as never);
    const serialized = JSON.stringify(sections);

    assert.equal(serialized.includes(DOQYN_TERMS_VERSION), true);
    assert.equal(serialized.includes(PASSWORD_REVIEW_LABEL_KEY), true);
  });

  it('payload de envio inclui aceite e versão', () => {
    const payload = buildCompanySignupPayload(validForm);
    assert.equal(payload.acceptedTerms, true);
    assert.equal(payload.acceptedTermsVersion, DOQYN_TERMS_VERSION);
  });
});
