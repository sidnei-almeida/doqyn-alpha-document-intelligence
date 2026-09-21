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
    assert.ok(button.includes('.informacoes'));
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
    assert.ok(menu.includes('.verInformacoes'));
    assert.ok(menu.includes('.infoCurrentFolder'));
  });

  it('menu de contexto da pasta tem ver informações', () => {
    const menu = readSrc('features/library/components/ExplorerContextMenu.tsx');
    assert.ok(menu.includes('onShowFolderInfo'));
    assert.match(menu, /\.verInformacoes/);
  });

  it('menu de contexto do arquivo tem ver detalhes', () => {
    const menu = readSrc('features/library/components/ExplorerContextMenu.tsx');
    assert.ok(menu.includes('.verDetalhes'));
    assert.ok(menu.includes('onSelectFileDetails'));
  });

  it('drawer opcional abre e fecha sob demanda', () => {
    const drawer = readSrc('features/library/components/OptionalDetailsDrawer.tsx');
    const shell = readSrc('components/layout/WorkspaceSideDrawer.tsx');
    assert.ok(drawer.includes('library-details-drawer'));
    assert.ok(drawer.includes('library-details-drawer-close'));
    assert.ok(drawer.includes('WorkspaceSideDrawer'));
    // O botão de fechar deixou de repetir classes soltas e passou a ser o `IconButton` do
    // design system — a anatomia do controle mora lá, não em cada casca.
    assert.ok(shell.includes('IconButton'));
    // Escape passou a consultar a pilha de camadas: só a do topo fecha, senão fechar um
    // popover fecharia a gaveta atrás dele junto.
    assert.ok(shell.includes("event.key !== 'Escape' || !isTopLayer()"));
    assert.ok(drawer.includes('.closeDetails'));
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
