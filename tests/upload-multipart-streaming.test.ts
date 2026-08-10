import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { parseMultipart } from '../server/utils/parseMultipart.js';
import { isServiceError } from '../server/utils/serviceErrors.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function read(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

const BOUNDARY = '----doqyntestboundary';

function buildMultipartBody(input: {
  fields?: Record<string, string>;
  file?: { name: string; filename: string; content: Buffer };
}): Buffer {
  const parts: Buffer[] = [];

  for (const [name, value] of Object.entries(input.fields ?? {})) {
    parts.push(
      Buffer.from(
        `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
      ),
    );
  }

  if (input.file) {
    parts.push(
      Buffer.from(
        `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${input.file.name}"; ` +
          `filename="${input.file.filename}"\r\nContent-Type: application/pdf\r\n\r\n`,
      ),
      input.file.content,
      Buffer.from('\r\n'),
    );
  }

  parts.push(Buffer.from(`--${BOUNDARY}--\r\n`));
  return Buffer.concat(parts);
}

function fakeRequest(body: Buffer, contentType: string): IncomingMessage {
  const stream = Readable.from([body]) as unknown as IncomingMessage;
  stream.headers = {
    'content-type': contentType,
    'content-length': String(body.length),
  };
  return stream;
}

describe('upload multipart em streaming — Passo 6 do plano de escala', () => {
  it('extrai campos e arquivo de um corpo multipart válido', async () => {
    const content = Buffer.from('%PDF-1.4 conteúdo de teste');
    const body = buildMultipartBody({
      fields: { documentType: 'Contrato', notes: 'teste' },
      file: { name: 'file', filename: 'contrato.pdf', content },
    });

    const result = await parseMultipart(
      fakeRequest(body, `multipart/form-data; boundary=${BOUNDARY}`),
      { maxFileBytes: 1024 * 1024 },
    );

    assert.equal(result.fields.documentType, 'Contrato');
    assert.equal(result.fields.notes, 'teste');
    assert.equal(result.file?.filename, 'contrato.pdf');
    assert.equal(result.file?.mimeType, 'application/pdf');
    assert.equal(result.file?.size, content.length);
    assert.equal(result.file?.buffer.equals(content), true);
  });

  it('rejeita com 413 quando o arquivo passa do teto', async () => {
    const content = Buffer.alloc(4096, 0x41);
    const body = buildMultipartBody({
      file: { name: 'file', filename: 'grande.pdf', content },
    });

    await assert.rejects(
      () =>
        parseMultipart(fakeRequest(body, `multipart/form-data; boundary=${BOUNDARY}`), {
          maxFileBytes: 1024,
        }),
      (error: unknown) => {
        assert.ok(isServiceError(error));
        assert.equal(error.statusCode, 413);
        assert.equal(error.code, 'FILE_TOO_LARGE');
        return true;
      },
    );
  });

  it('devolve campos vazios quando o corpo não é multipart', async () => {
    const result = await parseMultipart(
      fakeRequest(Buffer.from('{"a":1}'), 'application/json'),
      { maxFileBytes: 1024 },
    );

    assert.deepEqual(result, { fields: {} });
  });

  it('rejeita quando o cliente abandona o envio no meio', async () => {
    const stream = new Readable({ read() {} }) as unknown as IncomingMessage;
    stream.headers = { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` };

    const pending = parseMultipart(stream, { maxFileBytes: 1024 * 1024 });

    stream.push(
      Buffer.from(
        `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; ` +
          `filename="parcial.pdf"\r\n\r\n`,
      ),
    );
    stream.push(Buffer.alloc(512, 0x41));
    setImmediate(() => stream.destroy());

    // Sem tratamento de abort a promise nunca assentava: o handler, o socket e o buffer já
    // acumulado ficavam presos na heap a cada upload interrompido.
    await assert.rejects(pending, (error: unknown) => {
      assert.ok(isServiceError(error));
      assert.equal(error.code, 'UPLOAD_ABORTED');
      return true;
    });
  });

  it('propaga erro do socket em vez de derrubar o processo', async () => {
    const stream = new Readable({ read() {} }) as unknown as IncomingMessage;
    stream.headers = { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` };

    const pending = parseMultipart(stream, { maxFileBytes: 1024 * 1024 });

    stream.push(Buffer.from(`--${BOUNDARY}\r\n`));
    setImmediate(() => stream.destroy(new Error('ECONNRESET')));

    await assert.rejects(pending, /ECONNRESET/);
  });

  it('recusa campo truncado em vez de entregar valor parcial', async () => {
    const body = buildMultipartBody({
      fields: { accessGroups: JSON.stringify(['grupo-a', 'grupo-b', 'grupo-c']) },
    });

    // Campo truncado chegaria como JSON quebrado e estouraria em JSON.parse como erro 500.
    await assert.rejects(
      () =>
        parseMultipart(fakeRequest(body, `multipart/form-data; boundary=${BOUNDARY}`), {
          maxFileBytes: 1024,
          maxFieldBytes: 8,
        }),
      (error: unknown) => {
        assert.ok(isServiceError(error));
        assert.equal(error.statusCode, 413);
        assert.equal(error.code, 'FIELD_TOO_LARGE');
        return true;
      },
    );
  });

  it('não drena corpo recusado sem limite', () => {
    const parser = read('server/utils/parseMultipart.ts');

    assert.ok(parser.includes('DRAIN_LIMIT_BYTES'));
    assert.ok(parser.includes('req.destroy()'));
    assert.ok(parser.includes("req.on('error'"));
    assert.ok(parser.includes("req.on('aborted'"));
  });

  it('usa busboy em streaming, não Buffer.concat do corpo inteiro', () => {
    const parser = read('server/utils/parseMultipart.ts');

    assert.ok(parser.includes("from 'busboy'"));
    assert.ok(parser.includes('limits:'));
    assert.ok(parser.includes('fileSize: maxFileBytes'));
    assert.ok(parser.includes('req.pipe(bb)'));

    // O parser antigo: acumulava o corpo e fazia split sobre string binária, síncrono e sem teto.
    assert.equal(parser.includes("toString('binary')"), false);
    assert.equal(parser.includes('for await (const chunk of req)'), false);
  });
});

describe('handler de upload — ordem de quota e teto de bytes', () => {
  const handler = read('api/documents/upload.ts');

  it('não mantém mais um parser multipart próprio', () => {
    assert.ok(handler.includes("from '../../server/utils/parseMultipart.js'"));
    assert.equal(handler.includes('async function parseMultipart'), false);
  });

  it('checa a quota antes de ler o corpo, mas só consome slot depois', () => {
    const checkAt = handler.indexOf('assertTenantQuotaAvailable(');
    const parseAt = handler.indexOf('await parseMultipart(');
    const consumeAt = handler.indexOf('await assertTenantQuota(');

    assert.ok(checkAt > -1 && parseAt > -1 && consumeAt > -1);
    assert.ok(
      checkAt < parseAt,
      'a quota tem de ser verificada antes do parse, senão o tenant bloqueado ainda consome CPU',
    );
    assert.ok(
      consumeAt > parseAt,
      'consumir antes do parse queimaria a cota de uploads que falham (arquivo grande, abort)',
    );
  });

  it('protege o JSON.parse de accessGroups', () => {
    assert.ok(handler.includes('parseAccessGroups'));
    assert.ok(handler.includes("'INVALID_ACCESS_GROUPS'"));
    assert.equal(handler.includes('JSON.parse(fields.accessGroups)'), false);
  });

  it('dá folga ao envelope multipart no corte por Content-Length', () => {
    assert.ok(handler.includes('MULTIPART_ENVELOPE_HEADROOM_BYTES'));
    assert.ok(handler.includes('maxUploadBytes + MULTIPART_ENVELOPE_HEADROOM_BYTES'));
  });

  it('rejeita por Content-Length antes de qualquer byte do corpo', () => {
    const declaredAt = handler.indexOf('declaredSizeExceedsLimit');
    const parseAt = handler.indexOf('await parseMultipart(');

    assert.ok(handler.includes("req.headers['content-length']"));
    assert.ok(handler.includes("code: 'FILE_TOO_LARGE'"));
    assert.ok(declaredAt > -1 && declaredAt < parseAt);
  });

  it('repassa o teto de storage ao parser', () => {
    assert.ok(handler.includes('maxFileBytes: maxUploadBytes'));
  });
});
