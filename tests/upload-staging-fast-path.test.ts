import assert from 'node:assert/strict';
import type { IncomingMessage } from 'node:http';
import { afterEach, describe, it } from 'node:test';
import { parseAnalyzePdfRequest } from '../server/utils/parseAnalyzePdfRequest.js';
import { buildR2CopySource } from '../server/storage/r2/r2StorageProvider.js';
import { isStoragePromotionQueueEnabled } from '../server/queues/storagePromotionQueue.js';

function jsonRequest(body: Record<string, unknown>): IncomingMessage {
  // O dispatcher entrega o corpo já desserializado em `req.body`; é o caminho que a rota usa.
  return { headers: { 'content-type': 'application/json' }, body } as unknown as IncomingMessage;
}

const HASH = 'a'.repeat(64);

describe('hash do navegador na entrada da análise', () => {
  it('aceita o sha256 e normaliza para minúsculas', async () => {
    const parsed = await parseAnalyzePdfRequest(
      jsonRequest({ jobId: 'job_1', sizeBytes: 10, sha256: HASH.toUpperCase() }),
    );
    assert.equal(parsed.mode, 'staging');
    assert.equal(parsed.mode === 'staging' && parsed.staging.sha256, HASH);
  });

  it('sem sha256 segue valendo — cliente antigo cai no cálculo do servidor', async () => {
    const parsed = await parseAnalyzePdfRequest(jsonRequest({ jobId: 'job_1', sizeBytes: 10 }));
    assert.equal(parsed.mode === 'staging' && parsed.staging.sha256, undefined);
  });

  it('recusa hash que não é SHA-256 em hexadecimal', async () => {
    await assert.rejects(
      parseAnalyzePdfRequest(jsonRequest({ jobId: 'job_1', sizeBytes: 10, sha256: 'abc' })),
      (error: unknown) => (error as { code?: string }).code === 'INVALID_SHA256',
    );
  });
});

describe('cópia dentro do R2', () => {
  it('codifica cada segmento da chave sem escapar as barras', () => {
    assert.equal(
      buildR2CopySource('doqyn-alpha', 'individuals/abc/tmp/job 1/Contrato ção.pdf'),
      'doqyn-alpha/individuals/abc/tmp/job%201/Contrato%20%C3%A7%C3%A3o.pdf',
    );
  });
});

describe('fila de promoção do arquivo confirmado', () => {
  const original = process.env.STORAGE_PROMOTION_ASYNC;
  afterEach(() => {
    if (original === undefined) delete process.env.STORAGE_PROMOTION_ASYNC;
    else process.env.STORAGE_PROMOTION_ASYNC = original;
  });

  it('STORAGE_PROMOTION_ASYNC=false devolve a cópia para dentro da confirmação', () => {
    process.env.STORAGE_PROMOTION_ASYNC = 'false';
    assert.equal(isStoragePromotionQueueEnabled(), false);
  });
});
