import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildPublicAccessRequestBody } from '../src/features/access-request/buildAccessRequestBody';
import { DOQYN_TERMS_VERSION } from '../src/legal/terms';

describe('access request payload', () => {
  const sample = {
    personType: 'business' as const,
    taxId: '12345678000199',
    firstName: 'João',
    lastName: 'Silva',
    email: 'joao@empresa.com',
    whatsapp: '+5554999887766',
    password: 'senha-segura-123',
    jobTitle: 'Analista',
    departmentText: 'Financeiro',
    reason: 'Preciso acessar documentos da área.',
    operationalNotificationsConsent: true,
    acceptedTerms: true,
    acceptedTermsVersion: DOQYN_TERMS_VERSION,
  };

  it('envia todos os campos no modo doqyn_auth', () => {
    const body = buildPublicAccessRequestBody(sample, 'doqyn_auth');

    assert.equal(body.acceptedTerms, true);
    assert.equal(body.acceptedTermsVersion, DOQYN_TERMS_VERSION);
    assert.equal(body.operationalNotificationsConsent, true);
    assert.equal('password' in body, true);
  });

  it('não inclui campos extras inesperados no modo doqyn_auth', () => {
    const body = buildPublicAccessRequestBody(sample, 'doqyn_auth');
    const keys = Object.keys(body).sort();

    assert.deepEqual(keys, [
      'acceptedTerms',
      'acceptedTermsVersion',
      'departmentText',
      'email',
      'firstName',
      'jobTitle',
      'lastName',
      'operationalNotificationsConsent',
      'password',
      'personType',
      'reason',
      'taxId',
      'tenantDisplayName',
      'whatsapp',
    ]);
  });
});
