import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesRoot = join(__dirname, '..', 'src', 'i18n', 'locales');

const LOCALES = ['pt-BR', 'es-PY', 'en-US'] as const;
const NAMESPACES = ['common', 'nav'] as const;

function readCatalog(locale: string, namespace: string): Record<string, unknown> {
  const raw = readFileSync(join(localesRoot, locale, `${namespace}.json`), 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}

describe('i18n catalogs', () => {
  for (const namespace of NAMESPACES) {
    it(`${namespace} namespace has identical keys across pt-BR, es-PY, en-US`, () => {
      const keySets = LOCALES.map((locale) => Object.keys(readCatalog(locale, namespace)).sort());
      const [reference, ...rest] = keySets;

      for (const [index, keys] of rest.entries()) {
        assert.deepEqual(
          keys,
          reference,
          `key set for ${namespace} in ${LOCALES[index + 1]} must match ${LOCALES[0]}`,
        );
      }
    });

    it(`${namespace} namespace has no empty values in any locale`, () => {
      for (const locale of LOCALES) {
        const catalog = readCatalog(locale, namespace);
        for (const [key, value] of Object.entries(catalog)) {
          assert.notEqual(value, '', `${namespace}.${key} must not be empty in ${locale}`);
        }
      }
    });
  }

  it('pt-BR nav values match current UI strings', () => {
    const nav = readCatalog('pt-BR', 'nav');
    assert.equal(nav.library, 'Biblioteca');
    assert.equal(nav.overview, 'Visão Geral');
    assert.equal(nav.trash, 'Lixeira');
  });

  it('pt-BR common values match current UI strings', () => {
    const common = readCatalog('pt-BR', 'common');
    assert.equal(common.manage, 'Gerenciar');
    assert.equal(common.help, 'Ajuda');
    assert.equal(common.storage, 'Armazenamento');
  });
});
