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

describe('home da Biblioteca (raiz)', () => {
  it('LibraryPage usa ExplorerRootHome na raiz browse', () => {
    const page = readSrc('features/library/LibraryPage.tsx');
    assert.ok(page.includes('ExplorerRootHome'));
    assert.ok(page.includes('pickRecentDocuments'));
    assert.ok(page.includes('explorer.isBrowseRoot'));
    assert.equal(page.includes('renderFileList(uncategorizedDocuments'), false);
  });

  it('raiz exibe header padronizado com título Biblioteca', () => {
    const page = readSrc('features/library/LibraryPage.tsx');
    const header = readSrc('features/library/components/ExplorerPageHeader.tsx');
    assert.ok(page.includes('ExplorerPageHeader'));
    assert.ok(page.includes("'Biblioteca'"));
    assert.ok(page.includes('showFilterChips={explorer.isBrowseRoot && !explorer.isSearchOrFilterAtRoot}'));
    assert.ok(header.includes('ExplorerToolbarActions'));
  });

  it('ExplorerRootHome organiza pastas inteligentes, recentes e sem categoria', () => {
    const home = readSrc('features/library/components/ExplorerRootHome.tsx');
    const grid = readSrc('features/library/components/ExplorerFolderGrid.tsx');
    assert.ok(home.includes('ExplorerFolderGrid'));
    assert.ok(home.includes('ExplorerRecentList'));
    assert.ok(home.includes('Sem categoria'));
    assert.ok(home.includes('explorer-root-home'));
    assert.ok(home.includes('viewMode'));
    assert.ok(grid.includes('Pastas inteligentes'));
  });

  it('pastas usam cards horizontais compactos com presença visual', () => {
    const card = readSrc('features/library/components/ExplorerFolderCard.tsx');
    assert.ok(card.includes('drive-folder-tile'));
    assert.ok(card.includes('explorer-folder-card'));
    assert.ok(card.includes('bg-doqyn-surface'));
    assert.ok(card.includes('min-h-[48px]'));
    assert.ok(card.includes('items-center'));
    assert.ok(card.includes('more_horiz'));
    assert.ok(card.includes('arquivo'));
    assert.equal(card.includes('min-h-[156px]'), false);
    assert.equal(card.includes('ShieldCheck'), false);
  });

  it('recentes derivados de updatedAt real', () => {
    const utils = readSrc('features/library/utils/libraryHomeSections.ts');
    assert.ok(utils.includes('pickRecentDocuments'));
    assert.ok(utils.includes('updatedAt'));
    assert.ok(utils.includes('RECENT_LIMIT'));
  });

  it('recentes em grade com cards e empty state discreto', () => {
    const recent = readSrc('features/library/components/ExplorerRecentList.tsx');
    const card = readSrc('features/library/components/files/DocumentFileCard.tsx');
    const empty = readSrc('features/library/components/RecentEmptyState.tsx');
    assert.ok(recent.includes('DocumentFilesGrid'));
    assert.ok(recent.includes('RecentEmptyState'));
    assert.ok(recent.includes('viewMode'));
    assert.ok(recent.includes('recent-files-grid'));
    assert.ok(card.includes('DocumentFileThumbnail'));
    assert.ok(empty.includes('Nenhum arquivo recente'));
    assert.ok(empty.includes('Enviar documento'));
  });

  it('modo grade é o padrão na URL', () => {
    const route = readSrc('features/library/hooks/useLibraryRouteState.ts');
    assert.ok(route.includes("'grid'"));
  });

  it('filtros na raiz usam chips minimalistas', () => {
    const chips = readSrc('features/library/components/ExplorerFilterChips.tsx');
    assert.ok(chips.includes('explorer-filter-chip'));
    assert.ok(chips.includes('STATUS_FILTER_OPTIONS'));
    assert.ok(chips.includes('PERIOD_FILTER_OPTIONS'));
  });

  it('toolbar de arquivos não aparece na raiz browse', () => {
    const page = readSrc('features/library/LibraryPage.tsx');
    const showMenusBlock = page.slice(
      page.indexOf('const showFilterMenus'),
      page.indexOf('const shellVariant'),
    );
    assert.equal(showMenusBlock.includes('isBrowseRoot'), false);
    assert.ok(showMenusBlock.includes('isInsideFolder'));
    assert.ok(page.includes('selectedCount > 0'));
  });

  it('raiz não usa FileTable administrativa', () => {
    const home = readSrc('features/library/components/ExplorerRootHome.tsx');
    assert.equal(home.includes('FileTable'), false);
    assert.equal(home.includes('<table'), false);
  });

  it('upload, viewer e context menu preservados na LibraryPage', () => {
    const page = readSrc('features/library/LibraryPage.tsx');
    assert.ok(page.includes('DocumentViewerModal'));
    assert.ok(page.includes('ExplorerContextMenu'));
    assert.ok(page.includes('startUploadFromFiles'));
    assert.ok(page.includes('ContextInfoButton'));
  });
});
