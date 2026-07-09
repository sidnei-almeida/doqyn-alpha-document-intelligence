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

describe('File Explorer da Biblioteca', () => {
  it('LibraryPage usa modo explorer: raiz com pastas, pasta com arquivos', () => {
    const page = readSrc('features/library/LibraryPage.tsx');
    assert.ok(page.includes('useLibraryExplorerMode'));
    assert.ok(page.includes('ExplorerShell'));
    assert.ok(page.includes('ExplorerRootHome'));
    assert.ok(page.includes('ExplorerContextMenu'));
    assert.equal(/\bFolderGrid\b/.test(page), false);
    assert.ok(page.includes('space: folder.id'));
    assert.ok(page.includes('isBrowseRoot'));
    assert.ok(page.includes('isInsideFolder'));
  });

  it('abrir pasta altera ?space= na URL via useLibraryRouteState', () => {
    const route = readSrc('features/library/hooks/useLibraryRouteState.ts');
    assert.ok(route.includes("space: searchParams.get('space')"));
    assert.ok(route.includes("next.set(key, value)"));
    assert.ok(route.includes("next.delete(key)"));
  });

  it('useLibraryExplorerMode distingue raiz browse, pasta e busca na raiz', () => {
    const mode = readSrc('features/library/hooks/useLibraryExplorerMode.ts');
    assert.ok(mode.includes('isBrowseRoot'));
    assert.ok(mode.includes('isInsideFolder'));
    assert.ok(mode.includes('isSearchOrFilterAtRoot'));
    assert.ok(mode.includes('state.space'));
  });

  it('raiz browse mostra ExplorerRootHome sem tabela administrativa', () => {
    const page = readSrc('features/library/LibraryPage.tsx');
    assert.ok(page.includes('explorer.isBrowseRoot'));
    assert.ok(page.includes('ExplorerRootHome'));
    assert.ok(page.includes('pickRecentDocuments'));
    assert.ok(page.includes('showFilterMenus'));
  });

  it('dentro da pasta filtra documentos e mostra empty state dedicado', () => {
    const page = readSrc('features/library/LibraryPage.tsx');
    const view = readSrc('features/library/hooks/useLibraryView.ts');
    const filters = readSrc('features/library/utils/libraryFilterUtils.ts');
    assert.ok(view.includes('buildLibraryDocumentFilters'));
    assert.ok(filters.includes('categoryId'));
    assert.ok(filters.includes('resolveLibraryCategoryId'));
    assert.ok(filters.includes('categories'));
    assert.ok(page.includes('Esta pasta ainda está vazia'));
    assert.ok(page.includes('EmptyFolderState'));
  });

  it('breadcrumb navega de volta à raiz', () => {
    const page = readSrc('features/library/LibraryPage.tsx');
    const crumbs = readSrc('features/library/components/LibraryBreadcrumbs.tsx');
    assert.ok(page.includes('onNavigateRoot={goToRoot}'));
    assert.ok(page.includes("update({ space: '' })"));
    assert.ok(crumbs.includes('onNavigateRoot'));
    assert.ok(crumbs.includes('Biblioteca'));
  });

  it('ExplorerFolderCard abre pasta sem seleção radio', () => {
    const card = readSrc('features/library/components/ExplorerFolderCard.tsx');
    assert.equal(card.includes('HoverCheckbox'), false);
    assert.equal(card.includes('isSelected'), false);
    assert.ok(card.includes('onOpen'));
    assert.ok(card.includes('data-explorer-item="folder"'));
  });

  it('context menu cobre área vazia, pasta e arquivo', () => {
    const menu = readSrc('features/library/components/ExplorerContextMenu.tsx');
    assert.ok(menu.includes("kind: 'empty'"));
    assert.ok(menu.includes("kind: 'folder'"));
    assert.ok(menu.includes("kind: 'file'"));
    assert.ok(menu.includes('Enviar documento'));
    assert.ok(menu.includes('Enviar documento nesta pasta'));
    assert.ok(menu.includes('Visualizar'));
    assert.ok(menu.includes('Ver tracking'));
    assert.equal(menu.includes('Criar arquivo'), false);
  });

  it('upload contextual passa categoryId via UploadContext', () => {
    const page = readSrc('features/library/LibraryPage.tsx');
    const types = readSrc('features/upload/types.ts');
    const layout = readSrc('app/layout/WorkspaceLayout.tsx');
    assert.ok(types.includes('categoryId?: string'));
    assert.ok(page.includes('uploadContext'));
    assert.ok(page.includes('startUploadFromFiles(files, context)'));
    assert.ok(page.includes('startUploadInFolder'));
    assert.ok(layout.includes('categoryId: activeCategory.id'));
  });

  it('ReviewDrawer mostra pasta de destino e aviso de mismatch', () => {
    const drawer = readSrc('features/upload/review/ReviewDrawer.tsx');
    assert.ok(drawer.includes('Pasta atual:'));
    assert.ok(drawer.includes('hasCategoryMismatch'));
    assert.ok(drawer.includes('item.context?.categoryName'));
  });

  it('arquivo: clique seleciona, duplo clique abre viewer', () => {
    const page = readSrc('features/library/LibraryPage.tsx');
    const row = readSrc('features/library/components/FileRow.tsx');
    const card = readSrc('features/library/components/files/DocumentFileCard.tsx');
    assert.ok(row.includes('onDoubleClick'));
    assert.ok(card.includes('interactFile'));
    assert.ok(page.includes('DocumentViewerModal'));
    assert.ok(page.includes('ExplorerActionsProvider'));
    assert.ok(page.includes('handleOpen'));
  });

  it('raiz sem pastas não parece quebrada (empty state intencional)', () => {
    const home = readSrc('features/library/components/ExplorerRootHome.tsx');
    const grid = readSrc('features/library/components/ExplorerFolderGrid.tsx');
    assert.ok(home.includes('library-root-empty'));
    assert.ok(grid.includes('explorer-folder-grid-empty'));
  });
});
