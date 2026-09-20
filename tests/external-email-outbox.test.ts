import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function read(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

/** Extrai cada chamada `pattern(...)` inteira, contando parênteses — regex simples corta no primeiro `)`. */
function extractBalancedCalls(source: string, pattern: RegExp): string[] {
  const calls: string[] = [];
  for (const match of source.matchAll(pattern)) {
    const start = match.index ?? 0;
    let depth = 0;
    let end = start + match[0].length;
    for (let i = start + match[0].length - 1; i < source.length; i += 1) {
      if (source[i] === '(') depth += 1;
      if (source[i] === ')') depth -= 1;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
    calls.push(source.slice(start, end));
  }
  return calls;
}

describe('outbox de e-mail externo — modelo Mongo', () => {
  it('external_email_outbox em SHARED_APP_COLLECTIONS', () => {
    const constants = read('server/db/constants.ts');
    assert.ok(constants.includes("externalEmailOutbox: 'external_email_outbox'"));
  });

  it('MongoExternalEmailOutboxRow não estende o modelo de membro', () => {
    const types = read('server/db/types.ts');
    assert.ok(types.includes('MongoExternalEmailOutboxRow'));
    assert.ok(types.includes('dedupeKey'));
    assert.ok(types.includes("ExternalEmailOutboxKind = 'external_share_invite'"));
    assert.equal(types.includes('MongoExternalEmailOutboxRow extends MongoNotificationDelivery'), false);
  });

  it('índice único no dedupeKey e índices de fila/teto/TTL', () => {
    const indexes = read('server/db/externalEmailOutboxIndexes.ts');
    assert.match(indexes, /key: \{ dedupeKey: 1 \}, unique: true/);
    assert.match(indexes, /status: 1, nextAttemptAt: 1, createdAt: 1/);
    assert.match(indexes, /recipientEmail: 1, status: 1, deliveredAt: -1/);
    assert.match(indexes, /tenantId: 1, createdAt: -1/);
    assert.match(indexes, /expireAfterSeconds: EXTERNAL_EMAIL_OUTBOX_TTL_SECONDS/);
  });

  it('índices registrados em sharedAppIndexSpecs e no setup de dev', () => {
    const specs = read('server/db/sharedAppIndexSpecs.ts');
    assert.ok(specs.includes('EXTERNAL_EMAIL_OUTBOX_INDEXES'));
    assert.ok(specs.includes('SHARED_APP_COLLECTIONS.externalEmailOutbox'));

    const setup = read('server/db/setupMongo.ts');
    assert.ok(setup.includes('ensureExternalEmailOutboxIndexes'));
  });
});

describe('outbox de e-mail externo — config', () => {
  it('teto por destinatário é menor que o do canal de membro', async () => {
    const { EXTERNAL_EMAIL_MAX_PER_RECIPIENT_PER_HOUR, EMAIL_MAX_PER_USER_PER_HOUR } =
      await import('../server/config/emailConfig.ts');
    assert.equal(EXTERNAL_EMAIL_MAX_PER_RECIPIENT_PER_HOUR, 6);
    assert.ok(EXTERNAL_EMAIL_MAX_PER_RECIPIENT_PER_HOUR < EMAIL_MAX_PER_USER_PER_HOUR);
  });
});

describe('outbox de e-mail externo — drenagem', () => {
  const outbox = read('server/services/notifications/externalEmailOutbox.ts');

  it('trava a linha antes de enviar, para duas instâncias não duplicarem o envio', () => {
    assert.match(outbox, /findOneAndUpdate/);
    assert.match(outbox, /status: 'sending'/);
    assert.match(outbox, /lockedAt/);
  });

  it('a trava vence sozinha, senão processo morto prenderia o e-mail para sempre', () => {
    assert.match(outbox, /LOCK_EXPIRA_MS/);
    assert.match(outbox, /lockedAt: \{ \$lte: limiteTrava \}/);
  });

  it('o teto por destinatário adia com nextAttemptAt, e não descarta', () => {
    assert.match(outbox, /EXTERNAL_EMAIL_MAX_PER_RECIPIENT_PER_HOUR/);
    assert.match(outbox, /nextAttemptAt: new Date\(agora\.getTime\(\) \+ 15 \* 60_000\)/);
    assert.equal(outbox.includes("status: 'discarded'"), false);
  });

  it('manda a chave de idempotência do provedor', () => {
    assert.match(outbox, /idempotencyKey: linha\._id/);
  });

  it('inserção duplicada por dedupeKey não lança — é tratada como já enfileirado', () => {
    assert.match(outbox, /code === 11000/);
    assert.match(outbox, /enqueued: false/);
  });

  it('nenhum log passa html/text/subject — só e-mail mascarado e metadados', () => {
    const logCalls = extractBalancedCalls(outbox, /logger\.\w+\(/g);
    assert.ok(logCalls.length > 0);
    for (const call of logCalls) {
      assert.equal(call.includes('.html'), false, call);
      assert.equal(call.includes('.text'), false, call);
      assert.equal(call.includes('.subject'), false, call);
    }
  });

  it('drenador externo tem timer próprio, independente do canal de membro', () => {
    assert.match(outbox, /startExternalEmailOutboxDrain/);
    assert.match(outbox, /stopExternalEmailOutboxDrain/);
    assert.equal(outbox.includes("import { startEmailOutboxDrain }"), false);
  });
});

describe('outbox de e-mail externo — boot', () => {
  it('server/apiServer.ts inicia o drenador externo sem tocar no existente', () => {
    const apiServer = read('server/apiServer.ts');
    assert.ok(apiServer.includes('startExternalEmailOutboxDrain'));
    assert.ok(apiServer.includes('startEmailOutboxDrain'));
  });
});

describe('convite de compartilhamento externo por e-mail — template', () => {
  it('carrega sender/tenant/prazo/permissão e o link, nunca o título do documento', async () => {
    const { buildExternalShareInviteEmail } =
      await import('../server/services/notifications/externalEmailTemplates.ts');
    const email = buildExternalShareInviteEmail({
      recipientLocale: 'pt-BR',
      inviteUrl: 'https://app.doqyn.com/guest/share/tok123',
      senderName: 'Ana Souza',
      tenantName: 'Acme Ltda',
      expiresAt: new Date('2026-10-20T00:00:00Z'),
      canDownload: false,
      message: 'Segue o contrato revisado.',
    });

    assert.match(email.html, /Ana Souza/);
    assert.match(email.html, /Acme Ltda/);
    assert.match(email.html, /20\/10\/2026/);
    assert.match(email.html, /Somente visualizar/);
    assert.match(email.html, /Segue o contrato revisado\./);
    assert.match(email.html, /href="https:\/\/app\.doqyn\.com\/guest\/share\/tok123"/);
    assert.match(email.text, /https:\/\/app\.doqyn\.com\/guest\/share\/tok123/);
  });

  it('canDownload muda o rótulo de permissão', async () => {
    const { buildExternalShareInviteEmail } =
      await import('../server/services/notifications/externalEmailTemplates.ts');
    const email = buildExternalShareInviteEmail({
      recipientLocale: 'pt-BR',
      inviteUrl: 'https://app.doqyn.com/guest/share/tok123',
      senderName: 'Ana Souza',
      tenantName: 'Acme Ltda',
      expiresAt: null,
      canDownload: true,
      message: null,
    });
    assert.match(email.html, /Visualizar e baixar/);
  });

  it('não aceita título nem nome de arquivo do documento — a assinatura não tem esse parâmetro', async () => {
    const source = read('server/services/notifications/externalEmailTemplates.ts');
    const signatureMatch = source.match(/export function buildExternalShareInviteEmail\(([^)]*)\)/s);
    assert.ok(signatureMatch);
    assert.equal(/documentTitle|documentName|fileName/.test(signatureMatch![1]), false);
  });

  it('escapa senderName e message — nunca marcação crua no html', async () => {
    const { buildExternalShareInviteEmail } =
      await import('../server/services/notifications/externalEmailTemplates.ts');
    const email = buildExternalShareInviteEmail({
      recipientLocale: 'pt-BR',
      inviteUrl: 'https://app.doqyn.com/guest/share/tok123',
      senderName: '<img src=x onerror=alert(1)>',
      tenantName: 'Acme Ltda',
      expiresAt: null,
      canDownload: false,
      message: '<script>alert(2)</script>',
    });
    assert.equal(email.html.includes('<img src=x'), false);
    assert.equal(email.html.includes('<script>'), false);
    assert.match(email.html, /&lt;img/);
    assert.match(email.html, /&lt;script&gt;/);
  });

  it('idioma do destinatário muda a cópia', async () => {
    const { buildExternalShareInviteEmail } =
      await import('../server/services/notifications/externalEmailTemplates.ts');
    const ptBR = buildExternalShareInviteEmail({
      recipientLocale: 'pt-BR',
      inviteUrl: 'https://app.doqyn.com/guest/share/tok123',
      senderName: 'Ana Souza',
      tenantName: 'Acme Ltda',
      expiresAt: null,
      canDownload: false,
      message: null,
    });
    const enUS = buildExternalShareInviteEmail({
      recipientLocale: 'en-US',
      inviteUrl: 'https://app.doqyn.com/guest/share/tok123',
      senderName: 'Ana Souza',
      tenantName: 'Acme Ltda',
      expiresAt: null,
      canDownload: false,
      message: null,
    });
    assert.notEqual(ptBR.subject, enUS.subject);
    assert.match(enUS.html, /Open document/);

    const semLocale = buildExternalShareInviteEmail({
      recipientLocale: null,
      inviteUrl: 'https://app.doqyn.com/guest/share/tok123',
      senderName: 'Ana Souza',
      tenantName: 'Acme Ltda',
      expiresAt: null,
      canDownload: false,
      message: null,
    });
    assert.equal(semLocale.subject, ptBR.subject);
  });
});

describe('convite de compartilhamento externo por e-mail — wiring no serviço', () => {
  const service = read('server/services/sharing/externalDocumentShareService.ts');

  it('createDocumentExternalShareGrant enfileira nos dois ramos (existente e novo)', () => {
    assert.match(service, /enqueueExternalEmail/);
    assert.match(service, /kind: 'external_share_invite'/);
    const occurrences = service.match(/enqueueExternalEmail\(/g) ?? [];
    assert.ok(occurrences.length >= 2, `esperava 2+ chamadas, achou ${occurrences.length}`);
  });

  it('a chave de dedupe usa o id da concessão e o hash do token novo', () => {
    assert.match(service, /dedupeKey: `external_share:\$\{existing\._id\}:\$\{inviteTokenHash\}`/);
    assert.match(service, /dedupeKey: `external_share:\$\{grant\._id\}:\$\{inviteTokenHash\}`/);
  });

  it('regenerateDocumentExternalShareGrant também enfileira, com o hash novo', () => {
    const regenerateBlock = service.slice(service.indexOf('export async function regenerateDocumentExternalShareGrant'));
    assert.match(regenerateBlock, /enqueueExternalEmail/);
    assert.match(regenerateBlock, /dedupeKey: `external_share:\$\{shareId\}:\$\{inviteTokenHash\}`/);
  });
});

describe('convite de assinatura externa por e-mail — template', () => {
  it('carrega sender/tenant/prazo e o link do portal, nunca o título do documento', async () => {
    const { buildExternalSignatureInviteEmail } =
      await import('../server/services/notifications/externalEmailTemplates.ts');
    const email = buildExternalSignatureInviteEmail({
      recipientLocale: 'pt-BR',
      portalUrl: 'https://app.doqyn.com/guest/sign/tok456',
      senderName: 'Bruno Lima',
      tenantName: 'Acme Ltda',
      expiresAt: new Date('2026-11-05T00:00:00Z'),
      message: 'Favor assinar até o fim do mês.',
    });

    assert.match(email.html, /Bruno Lima/);
    assert.match(email.html, /Acme Ltda/);
    assert.match(email.html, /05\/11\/2026/);
    assert.match(email.html, /Favor assinar até o fim do mês\./);
    assert.match(email.html, /href="https:\/\/app\.doqyn\.com\/guest\/sign\/tok456"/);
    assert.match(email.text, /https:\/\/app\.doqyn\.com\/guest\/sign\/tok456/);
  });

  it('não aceita título nem nome de arquivo do documento — a assinatura não tem esse parâmetro', async () => {
    const source = read('server/services/notifications/externalEmailTemplates.ts');
    const signatureMatch = source.match(
      /export function buildExternalSignatureInviteEmail\(([^)]*)\)/s,
    );
    assert.ok(signatureMatch);
    assert.equal(/documentTitle|documentName|fileName/.test(signatureMatch![1]), false);
  });

  it('copy distinta do convite de compartilhamento — o pedido é de assinar, não de ver', async () => {
    const { buildExternalShareInviteEmail, buildExternalSignatureInviteEmail } =
      await import('../server/services/notifications/externalEmailTemplates.ts');
    const share = buildExternalShareInviteEmail({
      recipientLocale: 'pt-BR',
      inviteUrl: 'https://app.doqyn.com/guest/share/tok1',
      senderName: 'Ana',
      tenantName: 'Acme',
      expiresAt: null,
      canDownload: false,
      message: null,
    });
    const signature = buildExternalSignatureInviteEmail({
      recipientLocale: 'pt-BR',
      portalUrl: 'https://app.doqyn.com/guest/sign/tok2',
      senderName: 'Ana',
      tenantName: 'Acme',
      expiresAt: null,
      message: null,
    });
    assert.notEqual(share.subject, signature.subject);
  });

  it('escapa senderName e message', async () => {
    const { buildExternalSignatureInviteEmail } =
      await import('../server/services/notifications/externalEmailTemplates.ts');
    const email = buildExternalSignatureInviteEmail({
      recipientLocale: 'pt-BR',
      portalUrl: 'https://app.doqyn.com/guest/sign/tok456',
      senderName: '<img src=x onerror=alert(1)>',
      tenantName: 'Acme Ltda',
      expiresAt: null,
      message: '<script>alert(2)</script>',
    });
    assert.equal(email.html.includes('<img src=x'), false);
    assert.equal(email.html.includes('<script>'), false);
    assert.match(email.html, /&lt;img/);
    assert.match(email.html, /&lt;script&gt;/);
  });
});

describe('convite de assinatura externa por e-mail — wiring no serviço', () => {
  const service = read('server/services/signatures/documentSignatureService.ts');

  it('enfileira apenas quando portalToken foi gerado', () => {
    assert.match(service, /enqueueExternalEmail/);
    assert.match(service, /kind: 'external_signature_invite'/);
    const enqueueCallStart = service.indexOf('enqueueExternalEmail({');
    assert.ok(enqueueCallStart > -1);
    const before = service.slice(Math.max(0, enqueueCallStart - 200), enqueueCallStart);
    assert.match(before, /if \(portalToken\)/);
  });

  it('a chave de dedupe combina signatureRequestId e signerId', () => {
    assert.match(
      service,
      /dedupeKey: `external_signature:\$\{signatureRequestId\}:\$\{signerId\}`/,
    );
  });

  it('não enfileira para signatário interno do mesmo tenant — só a notificação in-app existente', () => {
    const createFn = service.slice(
      service.indexOf('export async function createDocumentSignatureRequest'),
      service.indexOf('export async function listDocumentSignatureRequests'),
    );
    assert.match(createFn, /notifySignatureRequested/);
    assert.match(createFn, /if \(portalToken\)/);
  });
});
