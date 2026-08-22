import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import type { IncomingMessage } from 'node:http';
import { parseAnalyzePdfRequest } from '../server/utils/parseAnalyzePdfRequest.js';

/**
 * O dispatcher lê o corpo do POST antes de chamar o handler e entrega o objeto já
 * desserializado em `req.body`, deixando o stream vazio. Quando o parser insistia em ler o
 * stream, o upload com URL pré-assinada falhava com JOB_ID_REQUIRED mesmo enviando o jobId.
 */
function fakeRequest(options: { body?: unknown; raw?: string }): IncomingMessage {
  const stream = Readable.from(options.raw ? [Buffer.from(options.raw)] : []);
  const req = stream as unknown as IncomingMessage & { body?: unknown };
  req.headers = { 'content-type': 'application/json' };
  if (options.body !== undefined) req.body = options.body;
  return req;
}

describe('parseAnalyzePdfRequest — corpo do upload em staging', () => {
  it('usa o corpo já desserializado pelo dispatcher, com o stream vazio', async () => {
    const parsed = await parseAnalyzePdfRequest(
      fakeRequest({ body: { jobId: 'job_abc123', sizeBytes: 4096, originalFileName: 'a.pdf' } }),
    );

    assert.equal(parsed.mode, 'staging');
    assert.equal(parsed.mode === 'staging' && parsed.staging.jobId, 'job_abc123');
  });

  it('ainda lê do stream quando ninguém pré-processou o corpo', async () => {
    const parsed = await parseAnalyzePdfRequest(
      fakeRequest({ raw: JSON.stringify({ jobId: 'job_stream', sizeBytes: 10 }) }),
    );

    assert.equal(parsed.mode === 'staging' && parsed.staging.jobId, 'job_stream');
  });

  it('segue recusando quando o jobId não vem', async () => {
    await assert.rejects(
      () => parseAnalyzePdfRequest(fakeRequest({ body: { sizeBytes: 10 } })),
      /jobId é obrigatório/,
    );
  });
});
