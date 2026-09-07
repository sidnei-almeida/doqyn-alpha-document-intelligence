import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { mapExtractedFieldSource } from '../server/ai/utils/mapMetadataSource.js';

const ROOT = process.cwd();

describe('Hotfix P0 — mapExtractedFieldSource', () => {
  it('preserva document_text e mapeia no_ai para document_text', () => {
    assert.equal(mapExtractedFieldSource('document_text'), 'document_text');
    assert.equal(mapExtractedFieldSource('no_ai'), 'document_text');
  });

  it('mapeia ai / undefined / desconhecido para ai', () => {
    assert.equal(mapExtractedFieldSource('ai'), 'ai');
    assert.equal(mapExtractedFieldSource(undefined), 'ai');
    assert.equal(mapExtractedFieldSource('something'), 'ai');
  });

  it('preserva manual', () => {
    assert.equal(mapExtractedFieldSource('manual'), 'manual');
  });

  it('confirm services usam mapExtractedFieldSource (não ternário quebrado)', () => {
    for (const rel of [
      'server/services/confirmAnalysisService.ts',
      'server/services/confirmUpdateDocumentVersionService.ts',
    ]) {
      const source = readFileSync(join(ROOT, rel), 'utf8');
      // O mapeamento foi para `confirm/confirmVersionShared.ts`, que os dois caminhos importam —
      // é o que garante que eles não voltem a divergir, que era o defeito original.
      assert.ok(source.includes('confirmVersionShared.js'));
      assert.equal(source.includes("field.source === 'no_ai' ? 'ai' : 'ai'"), false);
      assert.ok(source.includes('sanitizeAuditMetadata'));
    }

    const shared = readFileSync(
      join(ROOT, 'server/services/confirm/confirmVersionShared.ts'),
      'utf8',
    );
    assert.ok(shared.includes('mapExtractedFieldSource'));
  });
});
