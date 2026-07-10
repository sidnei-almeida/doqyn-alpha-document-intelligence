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

describe('detalhes sob demanda na Biblioteca', () => {
  it('ExplorerShell não reserva coluna fixa para painel de detalhes', () => {
    const shell = readSrc('features/library/components/ExplorerShell.tsx');
    assert.equal(shell.includes('detailsPanel'), false);
    assert.ok(shell.includes('w-full'));
    assert.equal(shell.includes('library-details-panel'), false);
    assert.equal(shell.includes('lg:flex'), false);
  });

  it('LibraryPage não renderiza painel lateral fixo por padrão', () => {
    const page = readSrc('features/library/LibraryPage.tsx');
    assert.equal(page.includes('detailsPanel='), false);
    assert.ok(page.includes('OptionalDetailsDrawer'));
    assert.ok(page.includes('detailsDrawer'));
    assert.match(page, /\{detailsDrawer &&/);
  });

  it('ícone de informação aparece no header', () => {
    const page = readSrc('features/library/LibraryPage.tsx');
    assert.ok(page.includes('ContextInfoButton'));
    const button = readSrc('features/library/components/ContextInfoButton.tsx');
    assert.ok(button.includes('library-context-info-button'));
    assert.ok(button.includes('Informações'));
  });

  it('clicar no ícone abre popover de informações', () => {
    const button = readSrc('features/library/components/ContextInfoButton.tsx');
    assert.ok(button.includes('LibraryInfoPopover'));
    assert.ok(button.includes('onOpenChange'));
    const popover = readSrc('features/library/components/LibraryInfoPopover.tsx');
    assert.ok(popover.includes('library-info-popover'));
  });

  it('menu de contexto da área vazia tem ver informações', () => {
    const menu = readSrc('features/library/components/ExplorerContextMenu.tsx');
    assert.ok(menu.includes('onShowContextInfo'));
    assert.ok(menu.includes('Ver informações'));
    assert.ok(menu.includes('Ver informações da pasta atual'));
  });

  it('menu de contexto da pasta tem ver informações', () => {
    const menu = readSrc('features/library/components/ExplorerContextMenu.tsx');
    assert.ok(menu.includes('onShowFolderInfo'));
    assert.match(menu, /label="Ver informações"/);
  });

  it('menu de contexto do arquivo tem ver detalhes', () => {
    const menu = readSrc('features/library/components/ExplorerContextMenu.tsx');
    assert.ok(menu.includes('Ver detalhes'));
    assert.ok(menu.includes('onSelectFileDetails'));
  });

  it('drawer opcional abre e fecha sob demanda', () => {
    const drawer = readSrc('features/library/components/OptionalDetailsDrawer.tsx');
    const shell = readSrc('components/layout/WorkspaceSideDrawer.tsx');
    assert.ok(drawer.includes('library-details-drawer'));
    assert.ok(drawer.includes('library-details-drawer-close'));
    assert.ok(drawer.includes('WorkspaceSideDrawer'));
    assert.ok(shell.includes('explorer-icon-btn shrink-0'));
    assert.ok(shell.includes("event.key === 'Escape'"));
    assert.ok(drawer.includes('Fechar painel de detalhes'));
    assert.ok(drawer.includes('canPreview'));
    assert.ok(drawer.includes('/tracking?documentId='));
  });

  it('card de pasta tem botão de informações no hover', () => {
    const card = readSrc('features/library/components/ExplorerFolderCard.tsx');
    assert.ok(card.includes('explorer-folder-info-button'));
    assert.ok(card.includes('onShowInfo'));
  });

  it('viewer, upload e navegação permanecem na LibraryPage', () => {
    const page = readSrc('features/library/LibraryPage.tsx');
    assert.ok(page.includes('DocumentViewerModal'));
    assert.ok(page.includes('startUploadFromFiles'));
    assert.ok(page.includes('LibraryContentDropZone'));
    assert.ok(page.includes('openSpace'));
    assert.ok(page.includes('goToRoot'));
  });
});
