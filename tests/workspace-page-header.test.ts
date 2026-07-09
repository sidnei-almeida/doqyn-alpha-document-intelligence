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

describe('WorkspacePageHeader padronizado', () => {
  it('WorkspacePageHeader define título, subtítulo e ações à direita', () => {
    const header = readSrc('components/layout/WorkspacePageHeader.tsx');
    assert.ok(header.includes('workspace-page-header'));
    assert.ok(header.includes('workspace-page-title'));
    assert.ok(header.includes('WorkspacePageActions'));
    assert.ok(header.includes('items-start justify-between'));
  });

  it('PageShell usa WorkspacePageHeader', () => {
    const shell = readSrc('components/layout/PageShell.tsx');
    assert.ok(shell.includes('WorkspacePageHeader'));
    assert.equal(shell.includes('border-b border-doqyn-border'), false);
  });

  it('info button usa tamanho padronizado workspace-action-btn e popover em portal', () => {
    const info = readSrc('features/library/components/ContextInfoButton.tsx');
    const popover = readSrc('components/ui/popover/AnchoredPopover.tsx');
    assert.ok(info.includes('workspace-action-btn'));
    assert.ok(info.includes('AnchoredPopover'));
    assert.ok(popover.includes('shadow-dropdown'));
  });

  it('Biblioteca usa ExplorerPageHeader unificado', () => {
    const page = readSrc('features/library/LibraryPage.tsx');
    const header = readSrc('features/library/components/ExplorerPageHeader.tsx');
    assert.ok(page.includes('ExplorerPageHeader'));
    assert.ok(header.includes('WorkspacePageHeader'));
    assert.ok(header.includes('ExplorerToolbarActions'));
  });

  it('pastas renderizam como cards com container visual', () => {
    const card = readSrc('features/library/components/ExplorerFolderCard.tsx');
    const globals = readSrc('styles/globals.css');
    assert.ok(card.includes('explorer-folder-card'));
    assert.ok(card.includes('bg-doqyn-surface'));
    assert.ok(card.includes('shadow-sm'));
    assert.ok(card.includes('rounded-xl'));
    assert.ok(globals.includes('.explorer-folder-card'));
  });

  it('pastas mantêm abertura e menu de contexto', () => {
    const card = readSrc('features/library/components/ExplorerFolderCard.tsx');
    assert.ok(card.includes('onOpen'));
    assert.ok(card.includes('onContextMenu'));
    assert.ok(card.includes('more_horiz'));
    assert.ok(card.includes('data-explorer-item="folder"'));
  });

  it('ações de view/filtro ficam no ExplorerToolbarActions, não duplicadas na LibraryToolbar', () => {
    const actions = readSrc('features/library/components/ExplorerToolbarActions.tsx');
    const toolbar = readSrc('features/library/components/LibraryToolbar.tsx');
    const page = readSrc('features/library/LibraryPage.tsx');
    assert.ok(actions.includes('showFilters'));
    assert.ok(page.includes('showFilterMenus'));
    assert.equal(toolbar.includes('ViewModeToggle'), false);
  });

  it('upload e viewer preservados', () => {
    const page = readSrc('features/library/LibraryPage.tsx');
    assert.ok(page.includes('DocumentViewerModal'));
    assert.ok(page.includes('ExplorerContextMenu'));
  });
});
