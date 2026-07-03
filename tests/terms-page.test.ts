import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DOQYN_TERMS_EFFECTIVE_DATE,
  DOQYN_TERMS_ROUTE,
  DOQYN_TERMS_VERSION,
  TERMS_SECTIONS,
} from '../src/legal/terms';

describe('terms page content', () => {
  it('expõe rota, versão e seções principais', () => {
    assert.equal(DOQYN_TERMS_ROUTE, '/termos');
    assert.equal(DOQYN_TERMS_VERSION, 'v1.0-dev');
    assert.equal(DOQYN_TERMS_EFFECTIVE_DATE, '2026-07-02');
    assert.ok(TERMS_SECTIONS.length >= 10);
    assert.match(TERMS_SECTIONS[0]?.title ?? '', /Sobre o DOQYN/);
  });
});
