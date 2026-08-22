import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSecurityAuditRestricted,
  buildSecurityContext,
  encryptIpForSecurityAudit,
} from '../server/services/tracking/securityContext.js';

/**
 * Endurecimento da cripto de IP no tracking.
 *
 * A chave sempre teve 256 bits — é saída de SHA-256 — mas a força real é a entropia do segredo de
 * entrada, que não era validada. `TRACKING_IP_ENCRYPTION_KEY=abc` gerava uma chave "de 256 bits"
 * com a força de uma senha de três letras. E o sal do hash de IP caía num default público, o que
 * torna a coluna reversível: o espaço IPv4 é pequeno o bastante para tabelar inteiro.
 */

const ORIGINAL = { ...process.env };
const STRONG = 'x'.repeat(32);

beforeEach(() => {
  process.env = { ...ORIGINAL };
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe('TRACKING_IP_ENCRYPTION_KEY', () => {
  it('cifra o IP quando o segredo tem entropia suficiente', () => {
    process.env.TRACKING_IP_ENCRYPTION_KEY = STRONG;
    const encrypted = encryptIpForSecurityAudit('203.0.113.10');

    assert.ok(encrypted, 'deveria cifrar');
    assert.ok(!encrypted.includes('203.0.113'), 'não pode vazar o IP em claro');
  });

  it('recusa segredo curto em vez de derivar chave fraca em silêncio', () => {
    process.env.TRACKING_IP_ENCRYPTION_KEY = 'abc';
    assert.throws(
      () => encryptIpForSecurityAudit('203.0.113.10'),
      /pelo menos 32 caracteres/,
      'segredo de 3 caracteres tem de falhar, não virar chave de 256 bits',
    );
  });

  it('segue desligado quando a variável não está definida', () => {
    delete process.env.TRACKING_IP_ENCRYPTION_KEY;
    assert.equal(encryptIpForSecurityAudit('203.0.113.10'), undefined);
    assert.equal(buildSecurityAuditRestricted('203.0.113.10'), undefined);
  });

  it('cada cifragem usa IV novo — mesmo IP não produz o mesmo texto cifrado', () => {
    process.env.TRACKING_IP_ENCRYPTION_KEY = STRONG;
    const a = encryptIpForSecurityAudit('203.0.113.10');
    const b = encryptIpForSecurityAudit('203.0.113.10');

    assert.ok(a && b);
    assert.notEqual(a, b, 'IV repetido em GCM quebra a confidencialidade');
  });
});

describe('TRACKING_IP_HASH_SALT', () => {
  it('em produção, recusa subir com o sal padrão — ele é público neste repositório', () => {
    process.env.APP_ENV = 'production';
    delete process.env.TRACKING_IP_HASH_SALT;
    process.env.TRACKING_IP_ENCRYPTION_KEY = STRONG;

    assert.throws(
      () => buildSecurityContext({ headers: { 'x-forwarded-for': '203.0.113.10' } }),
      /obrigatória em produção/,
    );
  });

  it('em produção com sal configurado, funciona normalmente', () => {
    process.env.APP_ENV = 'production';
    process.env.TRACKING_IP_HASH_SALT = 'sal-proprio-do-deploy';
    process.env.TRACKING_IP_ENCRYPTION_KEY = STRONG;

    assert.ok(buildSecurityContext({ headers: { 'x-forwarded-for': '203.0.113.10' } }));
  });

  it('fora de produção, o default continua valendo para não travar o dev', () => {
    process.env.APP_ENV = 'development';
    delete process.env.TRACKING_IP_HASH_SALT;
    process.env.TRACKING_IP_ENCRYPTION_KEY = STRONG;

    assert.ok(buildSecurityContext({ headers: { 'x-forwarded-for': '203.0.113.10' } }));
  });
});
