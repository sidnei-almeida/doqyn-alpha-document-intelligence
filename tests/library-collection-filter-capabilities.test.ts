import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  pruneUnsupportedLibraryFilters,
  resolveCollectionFilterCapabilities,
} from '../src/features/library/utils/libraryCollectionFilterCapabilities.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, '..', 'src');

function readSrc(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), 'utf8');
}

describe('filtros por coleção da Biblioteca', () => {
  it('favoritos e lixeira expõem só ordenação e visualização', () => {
    for (const id of ['favoritos', 'lixeira', 'compartilhados'] as const) {
      const caps = resolveCollectionFilterCapabilities(id);
      assert.equal(caps.status, false);
      assert.equal(caps.type, false);
      assert.equal(caps.sort, true);
      assert.equal(caps.view, true);
    }
  });

  it('para-assinar não exibe menus de filtro de documento', () => {
    const caps = resolveCollectionFilterCapabilities('para-assinar');
    assert.equal(caps.sort, false);
    assert.equal(caps.view, false);
  });

  it('pruneUnsupportedLibraryFilters limpa status em favoritos', () => {
    const patch = pruneUnsupportedLibraryFilters(
      {
        q: '',
        space: '',
        view: 'list',
        sort: 'updatedAt',
        direction: 'desc',
        status: 'active',
        type: '',
        period: '',
        owner: '',
        scope: '',
      },
      'favoritos',
    );
    assert.ok(patch);
    assert.equal(patch.status, '');
  });

  it('LibraryPage passa filterCapabilities ao header', () => {
    const page = readSrc('features/library/LibraryPage.tsx');
    assert.ok(page.includes('resolveCollectionFilterCapabilities'));
    assert.ok(page.includes('filterCapabilities={filterCapabilities}'));
    assert.ok(page.includes('!isSignaturesView'));
  });

  it('status duplicado review_required removido das opções', () => {
    const options = readSrc('features/library/utils/libraryFilterOptions.ts');
    assert.equal(options.includes("'review_required'"), false);
    assert.ok(options.includes("'pending_review'"));
  });
});
