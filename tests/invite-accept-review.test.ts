import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildAcceptInvitePayload,
  validateAcceptInviteForm,
} from '../src/features/invite/inviteAcceptReview';

const root = join(import.meta.dirname, '..');

function readSrc(relativePath: string): string {
  return readFileSync(join(root, 'src', relativePath), 'utf8');
}

describe('invite accept review', () => {
  it('valida campos obrigatórios do aceite de convite', () => {
    const base = {
      firstName: 'Maria',
      lastName: 'Silva',
      password: 'senha-segura-123',
      confirmPassword: 'senha-segura-123',
      whatsapp: '+55 54 99999-8888',
      jobTitle: 'Analista',
      departmentText: 'Financeiro',
      acceptedTerms: true,
      informationDeclaration: true,
      consent: true,
    };

    const valid = validateAcceptInviteForm(base, {
      requiresAccountCreation: true,
      requiresPassword: true,
      requiresWhatsapp: true,
      email: 'maria@empresa.com',
      tenantDisplayName: 'Empresa Exemplo',
      tenantTaxIdMasked: '12.345.678/0001-99',
    });
    assert.equal(valid.valid, true);

    const missingWhatsapp = validateAcceptInviteForm(
      { ...base, whatsapp: '' },
      {
        requiresAccountCreation: true,
        requiresPassword: true,
        requiresWhatsapp: true,
        email: 'maria@empresa.com',
        tenantDisplayName: 'Empresa Exemplo',
      },
    );
    assert.equal(missingWhatsapp.valid, false);
  });

  it('monta payload com whatsapp, cargo e termos', () => {
    const payload = buildAcceptInvitePayload(
      {
        firstName: 'Maria',
        lastName: 'Silva',
        password: 'senha-segura-123',
        confirmPassword: 'senha-segura-123',
        whatsapp: '+55 54 99999-8888',
        jobTitle: 'Analista',
        departmentText: 'Financeiro',
        acceptedTerms: true,
        informationDeclaration: true,
        consent: true,
      },
      {
        requiresAccountCreation: true,
        requiresPassword: true,
        requiresWhatsapp: true,
        email: 'maria@empresa.com',
        tenantDisplayName: 'Empresa Exemplo',
      },
    );

    assert.equal(payload.jobTitle, 'Analista');
    assert.equal(payload.departmentText, 'Financeiro');
    assert.equal(payload.operationalNotificationsConsent, true);
    assert.equal(payload.informationDeclaration, true);
    assert.equal(payload.acceptedTerms, true);
    assert.ok(payload.whatsapp?.startsWith('55'));
  });
});

describe('AcceptInvitePage', () => {
  it('coleta whatsapp, cargo, setor e termos como solicitar acesso', () => {
    const page = readSrc('features/invite/AcceptInvitePage.tsx');
    assert.ok(page.includes('WhatsappInput'));
    assert.ok(page.includes('jobTitle'));
    assert.ok(page.includes('departmentText'));
    assert.ok(page.includes('TermsAcceptanceCheckbox'));
    assert.ok(page.includes('ReviewBeforeSubmitDialog'));
    assert.ok(page.includes('requiresPassword'));
  });
});
