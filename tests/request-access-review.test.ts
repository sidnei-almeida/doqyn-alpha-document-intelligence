import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildRequestAccessPayload,
  buildRequestAccessReviewSections,
  validateRequestAccessForm,
} from '../src/features/access-request/requestAccessReview';
import { DOQYN_TERMS_VERSION } from '../src/legal/terms';
import { PASSWORD_REVIEW_LABEL } from '../src/lib/reviewDisplay';

const validEmployeeForm = {
  personType: 'business' as const,
  taxId: '12.345.678/0001-99',
  tenantDisplayName: '',
  firstName: 'João',
  lastName: 'Silva',
  email: 'joao@empresa.com',
  password: 'senha-segura-123',
  confirmPassword: 'senha-segura-123',
  whatsapp: '+55 (54) 99988-7766',
  jobTitle: 'Analista',
  departmentText: 'Financeiro',
  reason: 'Preciso acessar documentos jurídicos.',
  acceptedTerms: true,
  informationDeclaration: true,
  consent: true,
};

describe('request access review flow', () => {
  it('bloqueia revisão sem aceite dos termos', () => {
    const result = validateRequestAccessForm(
      { ...validEmployeeForm, acceptedTerms: false },
      { employeeFlow: true },
    );

    assert.equal(result.valid, false);
    assert.equal(result.field, 'acceptedTerms');
  });

  it('seções de revisão mostram termos e não expõem senha', () => {
    const sections = buildRequestAccessReviewSections(validEmployeeForm, { employeeFlow: true });
    const serialized = JSON.stringify(sections);

    assert.equal(serialized.includes(DOQYN_TERMS_VERSION), true);
    assert.equal(serialized.includes(PASSWORD_REVIEW_LABEL), true);
    assert.equal(serialized.includes('senha-segura-123'), false);
  });

  it('payload de envio inclui aceite e versão dos termos', () => {
    const payload = buildRequestAccessPayload(validEmployeeForm, { employeeFlow: true });

    assert.equal(payload.acceptedTerms, true);
    assert.equal(payload.acceptedTermsVersion, DOQYN_TERMS_VERSION);
    assert.equal(payload.operationalNotificationsConsent, true);
  });
});
