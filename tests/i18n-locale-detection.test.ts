import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveSupportedLocale } from '../src/i18n/config.ts';

describe('resolveSupportedLocale', () => {
  it('maps es and es-* tags to es-PY', () => {
    assert.equal(resolveSupportedLocale(['es-AR']), 'es-PY');
    assert.equal(resolveSupportedLocale(['es']), 'es-PY');
  });

  it('maps en and en-* tags to en-US', () => {
    assert.equal(resolveSupportedLocale(['en-GB']), 'en-US');
    assert.equal(resolveSupportedLocale(['en']), 'en-US');
  });

  it('maps pt and pt-* tags to pt-BR', () => {
    assert.equal(resolveSupportedLocale(['pt-PT']), 'pt-BR');
    assert.equal(resolveSupportedLocale(['pt-BR']), 'pt-BR');
  });

  it('falls back to pt-BR for an unrecognized language', () => {
    assert.equal(resolveSupportedLocale(['fr-FR']), 'pt-BR');
  });

  it('falls back to pt-BR for an empty list', () => {
    assert.equal(resolveSupportedLocale([]), 'pt-BR');
  });

  it('honors preference order, using the first recognized tag', () => {
    assert.equal(resolveSupportedLocale(['en-US', 'pt-BR']), 'en-US');
  });

  it('is case-insensitive', () => {
    assert.equal(resolveSupportedLocale(['ES-py']), 'es-PY');
  });
});
