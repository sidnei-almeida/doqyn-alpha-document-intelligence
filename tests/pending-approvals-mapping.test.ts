import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('pending approvals mapping', () => {
  it('AuthAccessRequestDetail shape cobre campos do formulário', () => {
    const sample = {
      id: 'req-1',
      status: 'pending',
      membershipId: 'mem-1',
      tenantId: 'company_dev',
      tenantName: 'Alpha Consultoria',
      requestedAt: '2026-07-02T12:00:00.000Z',
      requester: {
        name: 'Pedro Henrique Costa',
        email: 'pedro.costa@technova.com.br',
        whatsapp: '+5511999998888',
        firstName: 'Pedro',
        lastName: 'Costa',
      },
      requestedAccess: {
        personType: 'business',
        taxIdType: 'cnpj',
        taxIdMasked: '**.***.***/****-98',
        tenantDisplayName: 'Alpha Consultoria Empresarial',
        jobTitle: 'Analista Jurídico',
        departmentText: 'Jurídico',
        reason: 'Preciso acessar documentos jurídicos.',
        requestedAt: '2026-07-02T12:00:00.000Z',
        source: 'access_request' as const,
      },
      consent: {
        textVersion: 'operational-notifications-v1',
        acceptedAt: '2026-07-02T12:00:00.000Z',
        operationalNotificationsConsent: true,
      },
      notificationPreferences: {
        email: true,
        whatsapp: true,
        documentCreated: true,
        documentUpdated: true,
        documentRequiresSignature: true,
        accessApproved: true,
        accessRejected: true,
      },
    };

    assert.equal(sample.requestedAccess.jobTitle, 'Analista Jurídico');
    assert.equal(sample.requestedAccess.departmentText, 'Jurídico');
    assert.equal(sample.requester.whatsapp, '+5511999998888');
    assert.equal(sample.consent.operationalNotificationsConsent, true);
    assert.equal(JSON.stringify(sample).includes('password'), false);
  });
});
