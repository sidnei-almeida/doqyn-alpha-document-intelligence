import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesRoot = join(__dirname, '..', 'src', 'i18n', 'locales');

const LOCALES = ['pt-BR', 'es-PY', 'en-US'] as const;

function readCatalog(locale: string): Record<string, unknown> {
  const raw = readFileSync(join(localesRoot, locale, 'auth.json'), 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const flatKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as Record<string, unknown>, flatKey));
    } else {
      keys.push(flatKey);
    }
  }
  return keys;
}

function flattenEntries(obj: Record<string, unknown>, prefix = ''): Array<[string, unknown]> {
  const entries: Array<[string, unknown]> = [];
  for (const [key, value] of Object.entries(obj)) {
    const flatKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      entries.push(...flattenEntries(value as Record<string, unknown>, flatKey));
    } else {
      entries.push([flatKey, value]);
    }
  }
  return entries;
}

describe('i18n auth namespace', () => {
  it('has identical flattened key sets across pt-BR, es-PY, en-US', () => {
    const keySets = LOCALES.map((locale) => flattenKeys(readCatalog(locale)).sort());
    const [reference, ...rest] = keySets;

    for (const [index, keys] of rest.entries()) {
      assert.deepEqual(
        keys,
        reference,
        `auth key set for ${LOCALES[index + 1]} must match ${LOCALES[0]}`,
      );
    }
  });

  it('has no empty leaf values in any locale', () => {
    for (const locale of LOCALES) {
      const catalog = readCatalog(locale);
      for (const [key, value] of flattenEntries(catalog)) {
        assert.notEqual(value, '', `auth.${key} must not be empty in ${locale}`);
      }
    }
  });

  it('contains a login group and a signup group in every locale', () => {
    for (const locale of LOCALES) {
      const catalog = readCatalog(locale);
      assert.ok(catalog.login, `auth.json in ${locale} must have a "login" group`);
      assert.ok(catalog.signup, `auth.json in ${locale} must have a "signup" group`);
    }
  });

  it('pt-BR login values match current UI strings (back-compat regression guard)', () => {
    const auth = readCatalog('pt-BR') as {
      login: Record<string, string>;
      signup: { common: Record<string, string>; individual: Record<string, string> };
    };
    assert.equal(auth.login.title, 'Entrar no sistema');
    assert.equal(auth.login.submit, 'Entrar com e-mail e senha');
    assert.equal(auth.signup.common.whatsapp, 'WhatsApp');
    assert.equal(auth.signup.individual.submit, 'Criar acesso CPF');
  });
});
