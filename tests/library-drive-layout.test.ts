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
