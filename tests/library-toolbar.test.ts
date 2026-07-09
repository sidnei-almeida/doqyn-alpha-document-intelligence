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

describe('toolbar da Biblioteca', () => {
  it('toolbar compõe filtros e view no ExplorerToolbarActions; bulk na LibraryToolbar', () => {
    const actions = readSrc('features/library/components/ExplorerToolbarActions.tsx');
    const toolbar = readSrc('features/library/components/LibraryToolbar.tsx');
    assert.ok(actions.includes('FilterMenu'));
    assert.ok(actions.includes('SortMenu'));
    assert.ok(actions.includes('ViewModeToggle'));
    assert.ok(toolbar.includes('BulkSelectionToolbar'));
  });

  it('ViewModeToggle alterna entre grade e lista com aria-pressed', () => {
    const toggle = readSrc('features/library/components/ViewModeToggle.tsx');
    assert.ok(toggle.includes('SegmentedIconToggle'));
    assert.ok(toggle.includes("'grid'"));
    assert.ok(toggle.includes("'list'"));
    assert.ok(toggle.includes('aria-label="Modo de visualização"'));
  });

  it('SortMenu oferece ordenação com direção na URL', () => {
    const sort = readSrc('features/library/components/SortMenu.tsx');
    const options = readSrc('features/library/utils/libraryFilterOptions.ts');
    for (const key of ['updatedAt', 'name', 'status', 'owner', 'category']) {
      assert.ok(options.includes(`'${key}'`), `sort ${key} presente`);
    }
    assert.ok(sort.includes('direction'));
  });

  it('buildLibraryDocumentFilters mapeia filtro Processado para status active na API', () => {
    const utils = readSrc('features/library/utils/libraryFilterUtils.ts');
    assert.ok(utils.includes("case 'processed'"));
    assert.ok(utils.includes("processingStatus: 'processed'"));
    assert.ok(utils.includes("status: 'active'"));
  });

  it('FilterMenu filtra por status sem virar FilterBar administrativa', () => {
    const filter = readSrc('features/library/components/FilterMenu.tsx');
    assert.ok(filter.includes('ToolbarSelect'));
    assert.ok(filter.includes('status'));
    assert.equal(filter.includes('FilterBar'), false);
  });

  it('ordenação local cobre todas as chaves', () => {
    const sortUtil = readSrc('features/library/utils/sortDocuments.ts');
    for (const key of ["case 'name'", "case 'status'", "case 'owner'", "case 'updatedAt'", "case 'category'"]) {
      assert.ok(sortUtil.includes(key));
    }
  });

  it('filtros e ordenação usam TanStack Query com estado na URL', () => {
    const view = readSrc('features/library/hooks/useLibraryView.ts');
    const route = readSrc('features/library/hooks/useLibraryRouteState.ts');
    const filters = readSrc('features/library/utils/libraryFilterUtils.ts');
    assert.ok(view.includes('useDocuments'));
    assert.ok(view.includes('buildLibraryDocumentFilters'));
    assert.ok(filters.includes('state.q'));
    assert.ok(filters.includes('state.status'));
    assert.ok(route.includes('next.set(key'));
    assert.ok(route.includes("'status'"));
    assert.ok(route.includes("'sort'"));
    assert.ok(route.includes("'direction'"));
  });
});
