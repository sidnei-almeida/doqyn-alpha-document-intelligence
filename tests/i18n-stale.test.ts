import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';

import {
  TARGETS,
  loadSources,
  referenceText,
  sourceHash,
  translationStatus,
} from '../scripts/i18n-sources.mjs';

const dirs: string[] = [];
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function catalogo(files: Record<string, Record<string, unknown>>): string {
  const root = mkdtempSync(join(tmpdir(), 'i18n-stale-'));
  dirs.push(root);
  for (const [locale, content] of Object.entries(files)) {
    mkdirSync(join(root, locale), { recursive: true });
    writeFileSync(join(root, locale, 'common.json'), JSON.stringify(content));
  }
  return root;
}

describe('frase de referência', () => {
  it('plural responde à mesma categoria, e a que o português não tem ao _other', () => {
    const pt = new Map([
      ['doc_one', 'Um documento'],
      ['doc_other', '{{count}} documentos'],
      ['titulo', 'Biblioteca'],
    ]);
    assert.equal(referenceText(pt, 'doc_one'), 'Um documento');
    assert.equal(referenceText(pt, 'doc_many'), '{{count}} documentos');
    assert.equal(referenceText(pt, 'titulo'), 'Biblioteca');
    assert.equal(referenceText(pt, 'sumiu'), undefined);
  });
});

describe('situação das traduções', () => {
  it('acusa desatualizada quando o português muda depois do registro', () => {
    const root = catalogo({
      'pt-BR': { titulo: 'Biblioteca nova' },
      'en-US': { titulo: 'Library' },
    });
    const { stale, unrecorded } = translationStatus(
      'en-US',
      { 'common:titulo': sourceHash('Biblioteca') },
      root,
    );
    assert.deepEqual(stale, ['common:titulo']);
    assert.deepEqual(unrecorded, []);
  });

  it('separa tradução sem registro e registro de chave que já saiu', () => {
    const root = catalogo({
      'pt-BR': { titulo: 'Biblioteca' },
      'en-US': { titulo: 'Library' },
    });
    const { stale, unrecorded, orphan } = translationStatus(
      'en-US',
      { 'common:removida': 'abc' },
      root,
    );
    assert.deepEqual(stale, []);
    assert.deepEqual(unrecorded, ['common:titulo']);
    assert.deepEqual(orphan, ['common:removida']);
  });
});

describe('i18n-add-keys registra o que escreve', () => {
  it('grava o hash do português em en-US e es-419, e apaga o registro do que remove', () => {
    const root = catalogo({
      'pt-BR': { velha: 'Antiga' },
      'en-US': { velha: 'Old' },
      'es-419': { velha: 'Vieja' },
    });
    const sourcesPath = join(root, 'sources.json');
    writeFileSync(
      sourcesPath,
      JSON.stringify({ 'en-US': { 'common:velha': 'x' }, 'es-419': { 'common:velha': 'x' } }),
    );
    const spec = join(root, 'spec.json');
    writeFileSync(
      spec,
      JSON.stringify({
        common: {
          titulo: ['Biblioteca', 'Library', 'Biblioteca'],
          doc: {
            one: ['Um documento', 'One document', 'Un documento'],
            other: ['{{count}} documentos', '{{count}} documents', '{{count}} documentos'],
            many: [null, null, '{{count}} de documentos'],
          },
          velha: null,
        },
      }),
    );

    const run = spawnSync(process.execPath, ['scripts/i18n-add-keys.mjs', spec], {
      env: { ...process.env, I18N_CATALOG_ROOT: root, I18N_SOURCES_PATH: sourcesPath },
      encoding: 'utf8',
    });
    assert.equal(run.status, 0, run.stderr);

    const sources = JSON.parse(readFileSync(sourcesPath, 'utf8'));
    assert.equal(sources['en-US']['common:titulo'], sourceHash('Biblioteca'));
    assert.equal(sources['en-US']['common:doc_one'], sourceHash('Um documento'));
    assert.equal(sources['es-419']['common:doc_many'], sourceHash('{{count}} documentos'));
    assert.equal(sources['en-US']['common:velha'], undefined);
    assert.equal(sources['es-419']['common:velha'], undefined);
    for (const locale of TARGETS) {
      assert.deepEqual(translationStatus(locale, sources[locale], root).stale, []);
    }
  });
});

describe('o repositório', () => {
  it('não tem tradução desatualizada nem sem registro', () => {
    const sources = loadSources();
    for (const locale of TARGETS) {
      const { stale, unrecorded } = translationStatus(locale, sources[locale]);
      assert.deepEqual(stale, [], `${locale}: rode npm run i18n:stale`);
      assert.deepEqual(unrecorded, [], `${locale}: rode npm run i18n:stale`);
    }
  });
});
