import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';
import { resolveExternalSharingConfig } from '../server/config/externalSharingConfig.js';

const TOUCHED = ['EXTERNAL_SHARING_ENABLED', 'APP_ENV'] as const;
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

describe('portão do compartilhamento externo', () => {
  it('produção sem a variável continua fechada, como antes', () => {
    setEnv({ APP_ENV: 'production' });
    assert.equal(resolveExternalSharingConfig().externalSharingEnabled, false);
  });

  it('a variável abre o portão em produção', () => {
    // Sem ela o modal de assinatura externa também caía, porque passa pelo compartilhamento.
    setEnv({ APP_ENV: 'production', EXTERNAL_SHARING_ENABLED: 'true' });
    assert.equal(resolveExternalSharingConfig().externalSharingEnabled, true);
  });

  it('a variável também fecha fora de produção', () => {
    setEnv({ APP_ENV: 'development', EXTERNAL_SHARING_ENABLED: 'false' });
    assert.equal(resolveExternalSharingConfig().externalSharingEnabled, false);
  });

  it('valor sem sentido não vale como "ligado" — cai no default do ambiente', () => {
    setEnv({ APP_ENV: 'production', EXTERNAL_SHARING_ENABLED: 'talvez' });
    assert.equal(resolveExternalSharingConfig().externalSharingEnabled, false);
  });

  it('configuração do tenant ganha da variável', () => {
    setEnv({ APP_ENV: 'production', EXTERNAL_SHARING_ENABLED: 'true' });
    assert.equal(
      resolveExternalSharingConfig({ externalSharingEnabled: false }).externalSharingEnabled,
      false,
    );
  });
});
