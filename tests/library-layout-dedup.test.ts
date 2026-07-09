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

function countOccurrences(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

describe('Biblioteca — header e toolbar sem duplicação', () => {
  const page = readSrc('features/library/LibraryPage.tsx');
  const header = readSrc('features/library/components/ExplorerPageHeader.tsx');
  const actions = readSrc('features/library/components/ExplorerToolbarActions.tsx');
  const toolbar = readSrc('features/library/components/LibraryToolbar.tsx');
  const popover = readSrc('components/ui/popover/useAnchoredFloating.ts');

  it('LibraryPage renderiza um único ExplorerPageHeader', () => {
    assert.equal(countOccurrences(page, '<ExplorerPageHeader'), 1);
    assert.equal(countOccurrences(page, '<WorkspacePageHeader'), 0);
    assert.equal(countOccurrences(page, '<ExplorerHomeHeader'), 0);
  });

  it('ações principais ficam no header via ExplorerToolbarActions', () => {
    assert.ok(header.includes('ExplorerToolbarActions'));
    assert.ok(actions.includes('ViewModeToggle'));
    assert.ok(actions.includes('FilterMenu'));
    assert.ok(actions.includes('SortMenu'));
    assert.ok(actions.includes('WorkspaceRefreshButton'));
    assert.equal(toolbar.includes('ViewModeToggle'), false);
    assert.equal(toolbar.includes('FilterMenu'), false);
  });

  it('LibraryToolbar só renderiza seleção em massa', () => {
    assert.ok(toolbar.includes('BulkSelectionToolbar'));
    assert.ok(page.includes('selectedCount > 0'));
  });

  it('ViewModeToggle definido uma vez em ExplorerToolbarActions', () => {
    assert.equal(countOccurrences(page, 'ViewModeToggle'), 0);
    assert.equal(countOccurrences(actions, '<ViewModeToggle'), 1);
  });

  it('ContextInfoButton aparece uma vez na página', () => {
    assert.equal(countOccurrences(page, '<ContextInfoButton'), 1);
  });

  it('coleções virtuais usam filtros no header', () => {
    assert.ok(page.includes('showFilterMenus'));
    assert.ok(page.includes('explorer.isVirtualCollection'));
  });

  it('raiz usa chips de filtro sem menus duplicados', () => {
    assert.ok(page.includes('showFilterChips={explorer.isBrowseRoot && !explorer.isSearchOrFilterAtRoot}'));
    assert.ok(header.includes('ExplorerFilterChips'));
  });

  it('popover usa flip/clamp para permanecer na viewport', () => {
    assert.ok(popover.includes('fitsViewport'));
    assert.ok(popover.includes('clampVisualPosition'));
    assert.ok(popover.includes('placementCandidates'));
    assert.ok(popover.includes('maxHeight'));
  });

  it('AnchoredPopover mede painel e reposiciona', () => {
    const anchored = readSrc('components/ui/popover/AnchoredPopover.tsx');
    const dismiss = readSrc('components/ui/popover/useDismissOnOutside.ts');
    assert.ok(anchored.includes('useAnchoredFloating(anchorRef, panelRef'));
    assert.ok(dismiss.includes('Escape'));
  });

  it('HeaderUserMenu usa AnchoredPopover alinhado à direita', () => {
    const menu = readSrc('components/layout/HeaderUserMenu.tsx');
    assert.ok(menu.includes('AnchoredPopover'));
    assert.ok(menu.includes('placement="bottom-end"'));
  });

  it('viewer, upload e context menu preservados', () => {
    assert.ok(page.includes('DocumentViewerModal'));
    assert.ok(page.includes('ExplorerContextMenu'));
    assert.ok(page.includes('startUploadFromFiles'));
  });
});
