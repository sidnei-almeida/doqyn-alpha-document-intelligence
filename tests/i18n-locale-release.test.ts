import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { loadSources, missingTranslations, translationStatus } from '../scripts/i18n-sources.mjs';
import { resolveRequestLocale } from '../server/i18n/index.ts';
import { LOCALE_RELEASE, isExposedLocale } from '../shared/localeExposure.ts';
import { DEFAULT_LOCALE, EXPOSED_LOCALES, LOCALES } from '../src/i18n/locales.ts';

describe('liberação de idioma (Fase 12)', () => {
  it('front e servidor leem o mesmo estado de cada idioma', () => {
    for (const locale of LOCALES) {
      assert.equal(locale.status, LOCALE_RELEASE[locale.code].status, locale.code);
    }
    assert.deepEqual(
      EXPOSED_LOCALES,
      LOCALES.filter((locale) => isExposedLocale(locale.code)).map((locale) => locale.code),
    );
    assert.ok(isExposedLocale(DEFAULT_LOCALE));
  });

  it('idioma exposto passou nos portões: catálogo completo, tradução em dia e QA registrado', () => {
    const sources = loadSources();
    for (const { code, status } of LOCALES) {
      if (code === DEFAULT_LOCALE || status !== 'ready') continue;
      assert.deepEqual(missingTranslations(code), [], `${code}: chaves faltando`);
      const { stale, unrecorded } = translationStatus(code, sources[code]);
      assert.deepEqual([...stale, ...unrecorded], [], `${code}: rode npm run i18n:stale`);
      assert.match(
        LOCALE_RELEASE[code].qaPassedAt ?? '',
        /^\d{4}-\d{2}-\d{2}$/,
        `${code}: sem a data do roteiro de QA manual`,
      );
    }
  });

  it('o catálogo de en-US e es-419 já está completo — o que segura a exposição é o QA', () => {
    for (const locale of ['en-US', 'es-419']) {
      assert.deepEqual(missingTranslations(locale), [], locale);
    }
  });

  it('o navegador não puxa idioma em preparo sozinho; ?lang= e perfil puxam', () => {
    for (const locale of ['en-US', 'es-419'] as const) {
      assert.equal(
        resolveRequestLocale({ headers: { 'accept-language': locale } }),
        isExposedLocale(locale) ? locale : DEFAULT_LOCALE,
        `cabeçalho ${locale}`,
      );
      assert.equal(resolveRequestLocale({ query: { lang: locale } }), locale);
      assert.equal(resolveRequestLocale({}, locale), locale);
    }
  });
});
