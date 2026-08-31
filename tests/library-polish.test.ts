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

describe('biblioteca — polimento visual', () => {
  it('iconDefaults centraliza tamanhos Material Symbols', () => {
    const source = readSrc('lib/iconDefaults.ts');
    assert.ok(source.includes('ICON_SIZE'));
    assert.ok(source.includes('nav: 20'));
    assert.ok(source.includes('sm: 18'));
  });

  it('globals define utilitários explorer (hover, seleção, ícone, foco)', () => {
    const globals = readFileSync(join(__dirname, '..', 'src', 'styles', 'globals.css'), 'utf8');
    assert.ok(globals.includes('.explorer-interactive'));
    assert.ok(globals.includes('.explorer-selected'));
    assert.ok(globals.includes('.explorer-icon-btn'));
    assert.ok(globals.includes('.explorer-focus-ring'));
    assert.ok(globals.includes('.menu-enter'));
  });

  it('linhas e cards do explorer usam seleção unificada', () => {
    const fileRow = readSrc('features/library/components/FileRow.tsx');
    const folderCard = readSrc('features/library/components/ExplorerFolderCard.tsx');
    const compactRow = readSrc('features/library/components/files/DocumentFileRow.tsx');
    assert.ok(fileRow.includes('explorer-selected'));
    assert.ok(folderCard.includes('explorer-interactive'));
    assert.ok(compactRow.includes('explorer-selected'));
  });

  it('FileTypeIcon usa Material Symbols via Icon', () => {
    const source = readSrc('components/ui/FileTypeIcon.tsx');
    assert.ok(source.includes("from '@/components/ui/Icon'"));
    assert.ok(source.includes('filled={isFolder'));
  });

  it('menus de contexto e + Novo têm animação menu-enter e sombra leve', () => {
    const contextMenu = readSrc('features/library/components/ExplorerContextMenu.tsx');
    const newMenu = readSrc('features/library/components/NewButtonMenu.tsx');
    const anchored = readSrc('components/ui/popover/AnchoredPopover.tsx');
    assert.ok(contextMenu.includes('menu-enter'));
    assert.ok(newMenu.includes('AnchoredPopover'));
    assert.ok(anchored.includes('menu-enter'));
    assert.ok(contextMenu.includes('shadow-dropdown'));
  });
});
