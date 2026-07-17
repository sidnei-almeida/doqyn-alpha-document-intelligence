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

describe('i18n shell/nav migration', () => {
  it('Providers wraps the app in I18nextProvider using the configured @/i18n instance', () => {
    const source = readSrc('app/providers.tsx');
    assert.ok(source.includes('I18nextProvider'));
    assert.ok(source.includes("from '@/i18n'"));
  });

  it('useDocumentLang syncs document.documentElement.lang with languageChanged', () => {
    const source = readSrc('i18n/useDocumentLang.ts');
    assert.ok(source.includes('documentElement.lang'));
    assert.ok(source.includes('languageChanged'));
  });

  it('nav constants no longer hardcode Portuguese labels', () => {
    const source = readSrc('lib/constants.ts');
    assert.equal(source.includes("'Visão Geral'"), false);
    assert.equal(source.includes("'Compartilhados comigo'"), false);
  });

  it('Sidebar renders nav items via useTranslation', () => {
    const source = readSrc('components/layout/Sidebar.tsx');
    assert.ok(source.includes('useTranslation'));
  });
});
