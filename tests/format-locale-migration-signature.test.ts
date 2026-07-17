import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const MIGRATED_FILES = [
  'src/features/library/utils/sortDocuments.ts',
  'src/features/signature/components/SignaturesAssignedPanel.tsx',
  'src/features/signature/utils/signatureSummaryDisplay.ts',
  'src/features/signature/SignaturePortalPage.tsx',
  'src/features/signature/InternalSignaturePage.tsx',
  'src/features/external-share/ExternalSharePortalPage.tsx',
];

const HARDCODED_SUBSTRINGS = [
  "toLocaleDateString('pt-BR'",
  "toLocaleTimeString('pt-BR'",
  "toLocaleString('pt-BR'",
  "Intl.DateTimeFormat('pt-BR'",
];

describe('format-locale migration — signature/external-share/library-sort cluster', () => {
  for (const rel of MIGRATED_FILES) {
    it(`${rel} uses @/lib/formatLocale`, () => {
      const source = readFileSync(join(root, rel), 'utf8');
      assert.ok(
        source.includes('@/lib/formatLocale'),
        `${rel} should import from @/lib/formatLocale`,
      );
    });

    it(`${rel} has no hardcoded 'pt-BR' formatting`, () => {
      const source = readFileSync(join(root, rel), 'utf8');
      for (const needle of HARDCODED_SUBSTRINGS) {
        assert.equal(
          source.includes(needle),
          false,
          `${rel} should not contain hardcoded ${needle}`,
        );
      }
    });
  }

  it('sortDocuments.ts uses localeCompareActive and drops hardcoded pt-BR compare', () => {
    const source = readFileSync(
      join(root, 'src/features/library/utils/sortDocuments.ts'),
      'utf8',
    );
    assert.ok(
      source.includes('localeCompareActive'),
      'sortDocuments.ts should call localeCompareActive',
    );
    assert.equal(
      source.includes("'pt-BR')"),
      false,
      "sortDocuments.ts should not contain a hardcoded 'pt-BR') locale argument",
    );
  });
});
