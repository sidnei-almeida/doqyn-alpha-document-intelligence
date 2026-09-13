import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { renderNotificationText } from '../server/i18n/index.ts';
import { compactNotificationParams } from '../shared/notificationText.ts';
import { expiryNotificationTitle } from '../server/services/expiry/documentExpiryAlertService.ts';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

describe('texto de notificação in-app', () => {
  it('sai no idioma pedido, com a variante escolhida pelos valores presentes', () => {
    const params = { actorName: 'Ana', documentName: 'Contrato', deadline: '2026-09-30' };
    assert.equal(
      renderNotificationText('pt-BR', 'signature_required', params)?.title,
      'Ana pediu sua assinatura em Contrato até 30/09/2026',
    );
    assert.equal(
      renderNotificationText('en-US', 'signature_required', params)?.title,
      'Ana requested your signature on Contrato by 09/30/2026',
    );
    assert.equal(
      renderNotificationText('es-419', 'signature_required', { documentName: 'Contrato' })?.title,
      'Alguien solicitó tu firma en Contrato',
    );
  });

  it('vencimento usa plural do idioma e distingue hoje, antes e depois', () => {
    const render = (locale: string, daysRemaining: number) =>
      renderNotificationText(locale, 'document_expiring', { documentName: 'Alvará', daysRemaining })
        ?.title;
    assert.equal(render('pt-BR', -1), 'Alvará venceu há 1 dia');
    assert.equal(render('pt-BR', 7), 'Alvará vence em 7 dias');
    assert.equal(render('en-US', 0), 'Alvará expires today');
    assert.equal(render('es-419', -3), 'Alvará venció hace 3 días');
    assert.equal(expiryNotificationTitle('Doc', 1), 'Doc vence em 1 dia');
  });

  it('o que a pessoa escreveu entra como está; sem mensagem, a frase do produto', () => {
    const base = { actorName: 'Ana', documentName: 'NF 12', canDownload: false };
    assert.equal(
      renderNotificationText('en-US', 'document_shared', { ...base, message: 'Olha isto' })?.body,
      'Olha isto',
    );
    assert.equal(
      renderNotificationText('en-US', 'document_shared', base)?.body,
      'You can view it, but not download it.',
    );
  });

  it('aprovação sem documento usa o tipo do pedido, traduzido', () => {
    const text = renderNotificationText('es-419', 'approval_decided', {
      approved: false,
      kind: 'document_download',
      memberName: 'Fornecedor',
      reason: 'Fora do prazo',
    });
    assert.equal(text?.title, 'Tu solicitud fue rechazada');
    assert.equal(text?.body, 'Descarga de documento → Fornecedor — Fora do prazo');
  });

  it('todo tipo gravado tem montagem', () => {
    const types = read('server/db/notificationTypes.ts')
      .match(/export type NotificationType =([^;]+);/)?.[1]
      .match(/'([a-z_]+)'/g)
      ?.map((quoted) => quoted.slice(1, -1));
    assert.ok(types && types.length > 10);
    for (const type of types) {
      const text = renderNotificationText('pt-BR', type, {
        documentName: 'X',
        daysRemaining: 1,
        kind: 'document_upload',
      });
      assert.ok(text?.title && !text.title.includes('inApp.'), type);
    }
  });

  it('valor vazio não chega como texto, e decide a variante', () => {
    assert.deepEqual(compactNotificationParams({ a: ' Ana ', b: '', c: null, d: false }), {
      a: 'Ana',
      d: false,
    });
    assert.equal(
      renderNotificationText(
        'pt-BR',
        'document_created',
        compactNotificationParams({ documentName: 'X', categoryName: '  ' }),
      )?.title,
      'X entrou sem categoria',
    );
  });

  it('o build de produção leva os catálogos que o servidor importa', () => {
    assert.ok(read('scripts/build-server.mjs').includes("'src/i18n/catalog'"));
    for (const dockerfile of ['docker/Dockerfile.api', 'docker/Dockerfile.worker']) {
      assert.ok(read(dockerfile).includes('COPY src/i18n/catalog ./src/i18n/catalog'), dockerfile);
    }
  });

  it('quem emite passa valores, não frase pronta', () => {
    for (const file of [
      'documentNotifications',
      'approvalNotifications',
      'memberNotifications',
      'inboundShareNotifications',
      'documentRequestNotifications',
    ]) {
      const source = read(`server/services/notifications/${file}.ts`);
      assert.equal(/\btitle:/.test(source), false, file);
      assert.equal(/\bbody:/.test(source), false, file);
    }
  });
});
