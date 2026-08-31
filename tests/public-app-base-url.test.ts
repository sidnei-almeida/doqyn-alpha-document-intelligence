import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';
import {
  assertPublicAppBaseUrlInProduction,
  isPublicAppBaseUrlConfigured,
  resolvePublicAppBaseUrl,
} from '../server/config/publicUrlConfig.js';

const TOUCHED = [
  'PUBLIC_APP_BASE_URL',
  'DOQYN_PUBLIC_APP_URL',
  'NODE_ENV',
  'APP_ENV',
] as const;

const original = new Map(TOUCHED.map((key) => [key, process.env[key]]));

function setEnv(values: Partial<Record<(typeof TOUCHED)[number], string | undefined>>) {
  for (const key of TOUCHED) {
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

afterEach(() => {
  for (const [key, value] of original) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('endereço público do app', () => {
  it('aceita o nome que o provisionamento escreve (DOQYN_PUBLIC_APP_URL)', () => {
    // O deploy só grava DOQYN_PUBLIC_APP_URL; se este módulo voltar a exigir o nome próprio,
    // a criação de solicitação de assinatura externa volta a responder 500 em produção.
    setEnv({ NODE_ENV: 'production', DOQYN_PUBLIC_APP_URL: 'https://app.doqyn.com' });

    assert.equal(isPublicAppBaseUrlConfigured(), true);
    assert.equal(resolvePublicAppBaseUrl(), 'https://app.doqyn.com');
    assert.doesNotThrow(() => assertPublicAppBaseUrlInProduction());
  });

  it('o nome específico ganha do provisionado quando os dois existem', () => {
    setEnv({
      NODE_ENV: 'production',
      PUBLIC_APP_BASE_URL: 'https://especifico.doqyn.com',
      DOQYN_PUBLIC_APP_URL: 'https://provisionado.doqyn.com',
    });

    assert.equal(resolvePublicAppBaseUrl(), 'https://especifico.doqyn.com');
  });

  it('sem nenhum dos dois, produção falha no boot e não no meio da requisição', () => {
    setEnv({ NODE_ENV: 'production' });

    assert.equal(isPublicAppBaseUrlConfigured(), false);
    assert.throws(() => assertPublicAppBaseUrlInProduction(), /DOQYN_PUBLIC_APP_URL/);
    assert.throws(() => resolvePublicAppBaseUrl('https://app.doqyn.com'), /DOQYN_PUBLIC_APP_URL/);
  });

  it('fora de produção o header da requisição continua servindo de reserva', () => {
    setEnv({ NODE_ENV: 'test' });

    assert.doesNotThrow(() => assertPublicAppBaseUrlInProduction());
    assert.equal(resolvePublicAppBaseUrl('http://127.0.0.1:5173'), 'http://127.0.0.1:5173');
    assert.equal(resolvePublicAppBaseUrl(), 'http://localhost:5173');
  });

  it('barra da direita some para o link não sair com barra dupla', () => {
    setEnv({ NODE_ENV: 'production', DOQYN_PUBLIC_APP_URL: 'https://app.doqyn.com/' });

    assert.equal(resolvePublicAppBaseUrl(), 'https://app.doqyn.com');
  });
});
