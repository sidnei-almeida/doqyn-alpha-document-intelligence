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

describe('layout drive-inspired da Biblioteca', () => {
  it('pastas usam tile horizontal drive-folder-tile', () => {
    const card = readSrc('features/library/components/ExplorerFolderCard.tsx');
    assert.ok(card.includes('drive-folder-tile'));
    assert.ok(card.includes('hover:bg-doqyn-surface-hover'));
    assert.equal(card.includes('folder.description'), false);
  });

  it('grade de pastas é responsiva com mais colunas', () => {
    const grid = readSrc('features/library/components/ExplorerFolderGrid.tsx');
    assert.ok(grid.includes('xl:grid-cols-4'));
    assert.equal(grid.includes('Categorias de governança'), false);
  });

  it('Biblioteca continua mostrando pastas na área principal', () => {
    const page = readSrc('features/library/LibraryPage.tsx');
    const home = readSrc('features/library/components/ExplorerRootHome.tsx');
    assert.ok(page.includes('ExplorerRootHome'));
    assert.ok(home.includes('ExplorerFolderGrid'));
  });

  it('upload e viewer preservados na LibraryPage', () => {
    const page = readSrc('features/library/LibraryPage.tsx');
    assert.ok(page.includes('DocumentViewerModal'));
    assert.ok(page.includes('startUploadFromFiles'));
    assert.ok(page.includes('ExplorerContextMenu'));
  });
});
