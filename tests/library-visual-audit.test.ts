import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, '..', 'src');

function readSrc(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), 'utf8');
}

function fileExists(relativePath: string): boolean {
  return existsSync(join(srcRoot, relativePath));
}

describe('auditoria visual — resíduos do design antigo', () => {
  it('componentes legados de dashboard foram removidos da biblioteca', () => {
    const legacy = [
      'features/library/components/FolderCard.tsx',
      'features/library/components/FolderGrid.tsx',
      'features/library/components/FileContextMenu.tsx',
      'features/library/components/SelectionToolbar.tsx',
    ];
    for (const path of legacy) {
      assert.equal(fileExists(path), false, `${path} não deve existir`);
    }
  });

  it('LibraryPage não importa componentes legados', () => {
    const page = readSrc('features/library/LibraryPage.tsx');
    assert.equal(/\bFolderGrid\b/.test(page), false);
    assert.equal(/\bFolderCard\b/.test(page), false);
    assert.equal(/\bFileContextMenu\b/.test(page), false);
    assert.ok(page.includes('ExplorerContextMenu'));
  });

  it('globals não expõe classes obsoletas panel-glow, gradient-action ou stagger-enter', () => {
    const globals = readFileSync(join(__dirname, '..', 'src', 'styles', 'globals.css'), 'utf8');
    assert.equal(globals.includes('.panel-glow'), false);
    assert.equal(globals.includes('.gradient-action'), false);
    assert.equal(globals.includes('.stagger-enter'), false);
  });

  it('tokens de pasta usam nomenclatura accent com aliases legados', () => {
    const tokens = readFileSync(join(__dirname, '..', 'src', 'styles', 'tokens.css'), 'utf8');
    assert.ok(tokens.includes('--folder-accent-juridico'));
    assert.ok(tokens.includes('--folder-gradient-juridico: var(--folder-accent-juridico)'));
    assert.equal(tokens.includes('--gradient-panel-glow'), false);
  });

  it('menus da biblioteca usam sombra dropdown leve', () => {
    const contextMenu = readSrc('features/library/components/ExplorerContextMenu.tsx');
    const newMenu = readSrc('features/library/components/NewButtonMenu.tsx');
    const anchored = readSrc('components/ui/popover/AnchoredPopover.tsx');
    assert.ok(contextMenu.includes('shadow-dropdown'));
    assert.ok(newMenu.includes('AnchoredPopover'));
    assert.ok(anchored.includes('shadow-dropdown'));
    assert.equal(contextMenu.includes('shadow-modal'), false);
  });

  it('upload overlay global não usa panel-glow nem gradient-action', () => {
    const overlay = readSrc('features/upload/drag-drop/UploadDropOverlay.tsx');
    assert.equal(overlay.includes('panel-glow'), false);
    assert.equal(overlay.includes('gradient-action'), false);
    assert.equal(overlay.includes('shadow-action-glow'), false);
    assert.ok(overlay.includes('shadow-dropdown'));
  });

  it('ReviewDrawer não usa panel-glow no cabeçalho', () => {
    const drawer = readSrc('features/upload/review/ReviewDrawer.tsx');
    assert.equal(drawer.includes('panel-glow'), false);
    assert.ok(drawer.includes('border-doqyn-border-subtle'));
  });

  it('ExplorerFolderCard é flat — sem stagger nem fundo card pesado', () => {
    const card = readSrc('features/library/components/ExplorerFolderCard.tsx');
    assert.equal(card.includes('stagger'), false);
    assert.equal(card.includes('bg-doqyn-card/40'), false);
    assert.ok(card.includes('hover:bg-doqyn-surface-hover'));
  });
});
