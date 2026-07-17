import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, '..', 'src');

function readSrc(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), 'utf8');
}

function readCommonCatalog(locale: string): Record<string, unknown> {
  const raw = readFileSync(join(srcRoot, 'i18n', 'locales', locale, 'common.json'), 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}

describe('i18n language selector wiring', () => {
  it('LanguageSelect is driven by useLocale, sources labels from language.* keys, and renders a radiogroup', () => {
    const source = readSrc('components/ui/LanguageSelect.tsx');
    assert.ok(source.includes('useLocale'));
    assert.ok(source.includes('language.'));
    assert.ok(source.includes('role="radiogroup"'));
    assert.ok(source.includes('aria-checked'));
  });

  it('LanguageSelect does not hardcode native language names', () => {
    const source = readSrc('components/ui/LanguageSelect.tsx');
    assert.equal(source.includes("'Português'"), false);
    assert.equal(source.includes("'Español'"), false);
    assert.equal(source.includes("'English'"), false);
  });

  it('HeaderUserMenu mounts LanguageSelect in the account popover', () => {
    const source = readSrc('components/layout/HeaderUserMenu.tsx');
    assert.ok(source.includes('LanguageSelect'));
  });

  it('PreferencesSettingsSection mounts LanguageSelect in a SettingsRow', () => {
    const source = readSrc('features/settings/components/sections/PreferencesSettingsSection.tsx');
    assert.ok(source.includes('LanguageSelect'));
  });

  it('all three common.json catalogs define the language object with native names', () => {
    for (const locale of ['pt-BR', 'es-PY', 'en-US']) {
      const catalog = readCommonCatalog(locale);
      const language = catalog.language as Record<string, string> | undefined;
      assert.ok(language, `missing language object in ${locale}/common.json`);
      assert.equal(typeof language?.label, 'string');
      assert.equal(language?.['pt-BR'], 'Português');
      assert.equal(language?.['es-PY'], 'Español');
      assert.equal(language?.['en-US'], 'English');
    }
  });
});
