import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { buildNotificationEmail } from '../server/services/notifications/emailTemplate.ts';
import type { MongoNotification } from '../server/db/types.ts';

function read(relative: string): string {
  return readFileSync(join(process.cwd(), relative), 'utf8');
}

function notificacao(overrides: Partial<MongoNotification> = {}): MongoNotification {
  return {
    _id: 'ntf_1',
    tenantId: 'company_dev',
    companyId: 'company_dev',
    type: 'document_expiring',
    userId: 'user_1',
    eventKey: 'doc_1:30',
    title: 'Contrato vence em 30 dias',
    createdAt: new Date(),
    ...overrides,
  } as MongoNotification;
}

describe('canal de e-mail — desligado por padrão', () => {
  it('sem NOTIFICATION_EMAIL_PROVIDER, o canal não existe', async () => {
    delete process.env.NOTIFICATION_EMAIL_PROVIDER;
    const { resolveEmailProviderConfig, isEmailChannelEnabled } =
      await import('../server/config/emailConfig.ts');
    assert.equal(resolveEmailProviderConfig(), null);
    assert.equal(isEmailChannelEnabled(), false);
  });

  it('provedor definido sem chave é recusado, e não aceito pela metade', async () => {
    process.env.NOTIFICATION_EMAIL_PROVIDER = 'resend';
    delete process.env.RESEND_API_KEY;
    delete process.env.NOTIFICATION_EMAIL_FROM;
    const { resolveEmailProviderConfig } = await import('../server/config/emailConfig.ts');
    assert.throws(() => resolveEmailProviderConfig(), /RESEND_API_KEY/);
    delete process.env.NOTIFICATION_EMAIL_PROVIDER;
  });

  it('a espera entre tentativas cresce e não passa do último degrau', async () => {
    const { emailRetryDelayMinutes, EMAIL_MAX_ATTEMPTS } =
      await import('../server/config/emailConfig.ts');
    assert.ok(emailRetryDelayMinutes(1) > emailRetryDelayMinutes(0));
    assert.ok(emailRetryDelayMinutes(2) > emailRetryDelayMinutes(1));
    assert.equal(emailRetryDelayMinutes(9), emailRetryDelayMinutes(3));
    assert.equal(EMAIL_MAX_ATTEMPTS, 4);
  });
});

describe('o e-mail do aviso', () => {
  it('leva ao documento quando existe, e à caixa de avisos quando não', () => {
    const comDoc = buildNotificationEmail(
      notificacao({ documentId: 'doc_1', documentName: 'Contrato.pdf' }),
      'https://app.doqyn.com',
    );
    assert.match(comDoc.html, /documento=doc_1/);
    assert.match(comDoc.subject, /Contrato\.pdf/);

    const semDoc = buildNotificationEmail(notificacao(), 'https://app.doqyn.com');
    assert.match(semDoc.html, /\/notificacoes/);
  });

  it('escapa o que veio do usuário, senão o nome do arquivo vira marcação', () => {
    const email = buildNotificationEmail(
      notificacao({ documentName: '<img src=x onerror=alert(1)>' }),
      'https://app.doqyn.com',
    );
    assert.equal(email.html.includes('<img src=x'), false);
    assert.match(email.html, /&lt;img/);
  });

  it('vai com versão em texto, para quem não renderiza HTML', () => {
    const email = buildNotificationEmail(
      notificacao({ body: 'Vence em 30 dias.' }),
      'https://x.dev',
    );
    assert.match(email.text, /Vence em 30 dias\./);
    assert.equal(email.text.includes('<table'), false);
  });
});

describe('o outbox de e-mail', () => {
  const drain = read('server/services/notifications/emailOutboxDrain.ts');

  it('trava a linha antes de enviar, para duas instâncias não duplicarem o aviso', () => {
    assert.match(drain, /findOneAndUpdate/);
    assert.match(drain, /status: 'sending'/);
    assert.match(drain, /lockedAt/);
  });

  it('a trava vence sozinha, senão processo morto prenderia o aviso para sempre', () => {
    assert.match(drain, /LOCK_EXPIRA_MS/);
    assert.match(drain, /lockedAt: \{ \$lte: limiteTrava \}/);
  });

  it('manda a chave de idempotência do provedor', () => {
    const provider = read('server/services/notifications/providers/resendEmailProvider.ts');
    assert.match(provider, /'Idempotency-Key'/);
    assert.match(drain, /idempotencyKey: linha\._id/);
  });

  it('recusa do provedor não vira retentativa infinita', () => {
    const provider = read('server/services/notifications/providers/resendEmailProvider.ts');
    // 4xx é recusa (não adianta repetir); 429 e 5xx são "tente de novo".
    assert.match(provider, /response\.status === 429 \|\| response\.status >= 500/);
    assert.match(drain, /tentativas >= EMAIL_MAX_ATTEMPTS/);
  });
});

describe('quais avisos viram e-mail', () => {
  it('o que só existe fora do app entra: resposta a pedido de acesso', async () => {
    const { isEmailEligible } =
      await import('../server/services/notifications/notificationPreferences.ts');
    assert.equal(isEmailEligible('access_approved'), true);
    assert.equal(isEmailEligible('access_rejected'), true);
  });

  it('trabalho atribuído e prazo entram', async () => {
    const { isEmailEligible } =
      await import('../server/services/notifications/notificationPreferences.ts');
    for (const tipo of [
      'signature_required',
      'document_requested',
      'approval_requested',
      'inbound_share_received',
      'document_expiring',
      'document_shared',
    ] as const) {
      assert.equal(isEmailEligible(tipo), true, tipo);
    }
  });

  it('aviso de atividade fica fora: é o volume que desqualifica os outros', async () => {
    const { isEmailEligible } =
      await import('../server/services/notifications/notificationPreferences.ts');
    assert.equal(isEmailEligible('document_created'), false);
    assert.equal(isEmailEligible('document_updated'), false);
  });

  it('preferência ligada não basta: o tipo também precisa merecer', async () => {
    const { channelsForMember } =
      await import('../server/services/notifications/notificationPreferences.ts');
    const aceitaTudo = { email: true, whatsapp: false } as never;
    assert.deepEqual(channelsForMember(aceitaTudo, 'document_created'), ['in_app']);
    assert.deepEqual(channelsForMember(aceitaTudo, 'signature_required'), ['in_app', 'email']);
  });

  it('o teto por pessoa adia, e não descarta', () => {
    const drain = read('server/services/notifications/emailOutboxDrain.ts');
    assert.match(drain, /EMAIL_MAX_PER_USER_PER_HOUR/);
    assert.match(drain, /nextAttemptAt: new Date\(agora\.getTime\(\) \+ 15 \* 60_000\)/);
    // Adiar mantém a linha viva; descartar seria perder o aviso.
    assert.equal(drain.includes("status: 'discarded'"), false);
  });
});
