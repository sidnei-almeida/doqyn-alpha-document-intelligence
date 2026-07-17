import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const MIGRATED_FILES = [
  'src/features/document-send/utils/workflowLogHelpers.ts',
  'src/features/document-send/utils/historyFormat.ts',
  'src/features/document-send/DocumentSendPage.tsx',
  'src/features/document-send/hooks/useBulkUploadQueue.ts',
  'src/features/document-send/services/analyzePdf.ts',
  'src/features/document-send/services/processDocumentWithAI.ts',
  'src/features/sharing/components/ShareDocumentModal.tsx',
  'src/features/document-update-version/utils/documentMetadataDisplay.ts',
];

const HARDCODED_SUBSTRINGS = [
  "toLocaleDateString('pt-BR'",
  "toLocaleTimeString('pt-BR'",
  "toLocaleString('pt-BR'",
  "Intl.DateTimeFormat('pt-BR'",
];

describe('format-locale migration — document-send cluster', () => {
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
});
