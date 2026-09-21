import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

describe('aceite dos termos leva o idioma em que foram lidos', () => {
  it('os três fluxos de aceite mandam a versão e o idioma juntos', () => {
    for (const file of [
      'src/features/company-signup/companySignupReview.ts',
      'src/features/individual-signup/individualSignupReview.ts',
      'src/features/invite/inviteAcceptReview.ts',
    ]) {
      const source = read(file);
      assert.match(
        source,
        /acceptedTermsVersion: DOQYN_TERMS_VERSION,\n\s+acceptedTermsLocale: acceptedTermsLocale\(\),/,
        file,
      );
    }
  });

  it('os termos existem nos três idiomas, com as mesmas seções', () => {
    const keys = (locale: string) =>
      Object.keys(
        (JSON.parse(read(`src/i18n/catalog/${locale}/legal.json`)) as { section: object }).section,
      );
    assert.deepEqual(keys('en-US'), keys('pt-BR'));
    assert.deepEqual(keys('es-419'), keys('pt-BR'));
  });
});
