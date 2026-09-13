import { i18n } from '../src/i18n';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DOQYN_TERMS_EFFECTIVE_DATE,
  DOQYN_TERMS_ROUTE,
  DOQYN_TERMS_VERSION,
  TERMS_SECTIONS,
} from '../src/legal/terms';
import { initI18nForTests } from './helpers/i18nForTests.ts';

describe('terms page content', () => {
  it('expõe rota, versão e seções principais', () => {
    assert.equal(DOQYN_TERMS_ROUTE, '/terms');
    assert.equal(DOQYN_TERMS_VERSION, 'v1.0-dev');
    assert.equal(DOQYN_TERMS_EFFECTIVE_DATE, '2026-07-02');
    assert.ok(TERMS_SECTIONS.length >= 10);
    // O título saiu do código para `legal.json`; a asserção segue a frase até lá.
    initI18nForTests();
    assert.match(i18n.t(TERMS_SECTIONS[0]?.titleKey ?? ''), /Sobre o DOQYN/);
  });
});
