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
