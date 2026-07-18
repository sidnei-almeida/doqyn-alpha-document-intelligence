import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import handler from '../api/geo/detect-country.js';

type MockResponse = {
  statusCode?: number;
  body?: unknown;
  status(code: number): MockResponse;
  json(payload: unknown): MockResponse;
};

function mockRes(): MockResponse {
  const res: MockResponse = {
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

describe('GET /api/geo/detect-country', () => {
  it('retorna o país do header cf-ipcountry (Cloudflare)', async () => {
    const req = { method: 'GET', headers: { 'cf-ipcountry': 'ES' } };
    const res = mockRes();

    await handler(req as never, res as never);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { country: 'ES' });
  });

  it('retorna country: null quando não há sinal de geo (IP local, sem headers)', async () => {
    const req = {
      method: 'GET',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    };
    const res = mockRes();

    await handler(req as never, res as never);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { country: null });
  });

  it('rejeita métodos diferentes de GET', async () => {
    const req = { method: 'POST', headers: {} };
    const res = mockRes();

    await handler(req as never, res as never);

    assert.equal(res.statusCode, 405);
  });
});
