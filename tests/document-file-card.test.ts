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

describe('DocumentFileCard unificado na Biblioteca', () => {
  it('DocumentFileCard renderiza DocumentFileThumbnail', () => {
    const card = readSrc('features/library/components/files/DocumentFileCard.tsx');
    const thumb = readSrc('features/library/components/files/DocumentFileThumbnail.tsx');
    assert.ok(card.includes('DocumentFileThumbnail'));
    assert.ok(card.includes('data-testid="document-file-card"'));
    assert.ok(thumb.includes('DocumentThumbnail'));
    assert.ok(thumb.includes('resolveDocumentVersionId'));
  });

  it('FileGridView usa DocumentFilesGrid com DocumentFileCard', () => {
    const grid = readSrc('features/library/components/FileGridView.tsx');
    const filesGrid = readSrc('features/library/components/files/DocumentFilesGrid.tsx');
    assert.ok(grid.includes('DocumentFilesGrid'));
    assert.ok(filesGrid.includes('DocumentFileCard'));
    assert.ok(filesGrid.includes('document-files-grid'));
  });

  it('Recentes e pasta usam o mesmo DocumentFileCard', () => {
    const recent = readSrc('features/library/components/ExplorerRecentList.tsx');
    const folderFiles = readSrc('features/library/components/ExplorerFolderFiles.tsx');
    const recentCard = readSrc('features/library/components/RecentFileCard.tsx');
    assert.ok(recent.includes('DocumentFilesGrid'));
    assert.ok(folderFiles.includes('FileGridView'));
    assert.ok(recentCard.includes('DocumentFileCard'));
  });

  it('grade compacta com colunas 200–240px', () => {
    const globals = readSrc('styles/globals.css');
    const card = readSrc('features/library/components/files/DocumentFileCard.tsx');
    assert.ok(globals.includes('.document-files-grid'));
    assert.ok(globals.includes('minmax(200px, 240px)'));
    assert.ok(card.includes('max-w-[240px]'));
  });

  it('canPreview=false não busca thumbnail', () => {
    const utils = readSrc('features/library/components/files/documentFileUtils.ts');
    const thumb = readSrc('features/documents/preview/DocumentThumbnail.tsx');
    assert.ok(utils.includes('documentCanPreview'));
    assert.ok(thumb.includes('previewBlocked'));
  });

  it('modo lista usa DocumentFileRow com miniatura pequena', () => {
    const row = readSrc('features/library/components/files/DocumentFileRow.tsx');
    const fileRow = readSrc('features/library/components/FileRow.tsx');
    assert.ok(row.includes('DocumentFileThumbnail'));
    assert.ok(row.includes('size="row"'));
    assert.ok(fileRow.includes('DocumentFileRowIcon'));
  });

  it('preview do card ocupa área inteira com cover', () => {
    const card = readSrc('features/library/components/files/DocumentFileCard.tsx');
    const globals = readSrc('styles/globals.css');
    assert.ok(card.includes('document-file-card__preview'));
    assert.ok(card.includes('absolute inset-0'));
    assert.ok(globals.includes("data-thumbnail-fit='cover'"));
    assert.ok(globals.includes('object-fit: cover'));
  });

  it('duplo clique e context menu preservados no card', () => {
    const card = readSrc('features/library/components/files/DocumentFileCard.tsx');
    assert.ok(card.includes('onDoubleClick'));
    assert.ok(card.includes('onContextMenu'));
    assert.ok(card.includes('openFile'));
    assert.ok(card.includes('useExplorerFileActions'));
  });

  it('ExplorerFolderFiles usa FileGridView no modo grade', () => {
    const folder = readSrc('features/library/components/ExplorerFolderFiles.tsx');
    assert.ok(folder.includes("viewMode === 'grid'"));
    assert.ok(folder.includes('variant="explorer"'));
  });
});
