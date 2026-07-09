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

describe('layout da Biblioteca', () => {
  it('LibraryPage compõe shell explorer, pastas, arquivos, detalhes e viewer seguro', () => {
    const page = readSrc('features/library/LibraryPage.tsx');
    assert.ok(page.includes('ExplorerShell'));
    assert.ok(page.includes('ExplorerRootHome'));
    assert.ok(page.includes('ExplorerFolderGrid') || page.includes('ExplorerRootHome'));
    assert.ok(page.includes('ExplorerFolderFiles'));
    assert.ok(page.includes('FileGridView'));
    assert.ok(page.includes('OptionalDetailsDrawer'));
    assert.ok(page.includes('ContextInfoButton'));
    assert.ok(page.includes('DocumentViewerModal'));
    assert.ok(page.includes('LibraryBreadcrumbs'));
    assert.ok(page.includes('useExplorerSelection'));
    assert.ok(page.includes('ExplorerActionsProvider'));
    assert.ok(page.includes('LibraryContentDropZone'));
    assert.ok(page.includes('DndContext'));
  });

  it('Biblioteca usa dados reais (useDocuments/listDocuments), sem mocks', () => {
    const view = readSrc('features/library/hooks/useLibraryView.ts');
    const api = readSrc('features/library/api/libraryApi.ts');
    const page = readSrc('features/library/LibraryPage.tsx');
    assert.ok(view.includes('useDocuments'));
    assert.ok(api.includes('listDocuments'));
    assert.ok(api.includes('fetchDocumentCategories'));
    assert.equal(page.includes('MOCK_DOCUMENTS'), false);
    assert.equal(view.includes('MOCK_DOCUMENTS'), false);
  });

  it('Biblioteca não contém KPIs, feed de logs nem upload hero', () => {
    const page = readSrc('features/library/LibraryPage.tsx');
    const shell = readSrc('features/library/components/ExplorerShell.tsx');
    for (const source of [page, shell]) {
      assert.equal(source.includes('MetricCard'), false);
      assert.equal(source.includes('ProcessingHistoryPanel'), false);
      assert.equal(source.includes('WorkflowLogRow'), false);
      assert.equal(source.includes('UploadDropzoneArea'), false);
      assert.equal(source.includes('UploadFlowPanel'), false);
    }
  });

  it('ExplorerFolderGrid renderiza pastas inteligentes a partir das categorias', () => {
    const grid = readSrc('features/library/components/ExplorerFolderGrid.tsx');
    const hook = readSrc('features/library/hooks/useCategoryFolders.ts');
    assert.ok(grid.includes('ExplorerFolderCard'));
    assert.ok(hook.includes('fetchDocumentCategories'));
    assert.ok(hook.includes('documentCount'));
  });

  it('FileRow: clique seleciona, duplo clique abre via contexto de ações', () => {
    const row = readSrc('features/library/components/FileRow.tsx');
    assert.ok(row.includes('onDoubleClick'));
    assert.ok(row.includes('interactFile'));
    assert.ok(row.includes('useExplorerFileActions'));
    assert.ok(row.includes('more_horiz'));
    assert.ok(row.includes('explorer-item-selected'));
    assert.ok(row.includes('aria-selected={isSelected}'));
    assert.ok(row.includes('FileTypeIcon'));
    assert.ok(row.includes('TruncatedText'));
    assert.ok(row.includes('onContextMenu'));
    assert.ok(row.includes("variant === 'explorer'"));
  });

  it('FileTable legado para busca/coleções; pasta usa ExplorerFolderFiles', () => {
    const table = readSrc('features/library/components/FileTable.tsx');
    const folderFiles = readSrc('features/library/components/ExplorerFolderFiles.tsx');
    assert.ok(table.includes('library-file-table-legacy'));
    assert.ok(folderFiles.includes('library-file-table'));
    assert.ok(folderFiles.includes('Modificado'));
  });

  it('empty state da pasta é direto, com ícone flat e ação de upload', () => {
    const empty = readSrc('features/library/components/EmptyFolderState.tsx');
    assert.ok(empty.includes('Enviar documento'));
    assert.ok(empty.includes('library-empty-state'));
    assert.ok(empty.includes('cloud_upload'));
    assert.equal(empty.includes('panel-glow'), false);
  });
});
