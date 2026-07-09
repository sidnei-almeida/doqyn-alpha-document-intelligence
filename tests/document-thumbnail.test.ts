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

describe('DocumentThumbnail — preview em cards da Biblioteca', () => {
  it('FileGridView renderiza DocumentFilesGrid com thumbnail', () => {
    const grid = readSrc('features/library/components/FileGridView.tsx');
    const card = readSrc('features/library/components/files/DocumentFileCard.tsx');
    assert.ok(grid.includes('DocumentFilesGrid'));
    assert.ok(card.includes('DocumentFileThumbnail'));
    assert.ok(card.includes('data-testid="document-file-card"'));
  });

  it('useDocumentThumbnail busca manifest e blob com cache React Query', () => {
    const hook = readSrc('features/documents/preview/useDocumentThumbnail.ts');
    assert.ok(hook.includes('fetchPreviewManifest'));
    assert.ok(hook.includes('fetchPreviewAssetBlob'));
    assert.ok(hook.includes('previewQueryKeys.manifest'));
    assert.ok(hook.includes('trackView: false'));
    assert.ok(hook.includes('canPreview'));
    assert.ok(hook.includes('ensureThumbnailObjectUrl'));
  });

  it('resolveThumbnailAssetUrl usa thumbnail da primeira página para PDF', () => {
    const utils = readSrc('features/documents/preview/documentThumbnailUtils.ts');
    assert.ok(utils.includes('pdf_pages'));
    assert.ok(utils.includes('pages[0].thumbnailUrl'));
  });

  it('resolveThumbnailAssetUrl usa thumbnail de imagem', () => {
    const utils = readSrc('features/documents/preview/documentThumbnailUtils.ts');
    assert.ok(utils.includes("viewerType === 'image'"));
    assert.ok(utils.includes('image.thumbnailUrl'));
  });

  it('canPreview=false não habilita carregamento', () => {
    const hook = readSrc('features/documents/preview/useDocumentThumbnail.ts');
    const thumb = readSrc('features/documents/preview/DocumentThumbnail.tsx');
    assert.ok(hook.includes('canPreview'));
    assert.ok(thumb.includes('previewBlocked'));
    assert.ok(thumb.includes("canPreview === false"));
  });

  it('erro no preview mostra fallback icon', () => {
    const thumb = readSrc('features/documents/preview/DocumentThumbnail.tsx');
    assert.ok(thumb.includes('FileTypeIcon'));
    assert.ok(thumb.includes("state === 'ready'"));
  });

  it('loading e processing mostram skeleton', () => {
    const thumb = readSrc('features/documents/preview/DocumentThumbnail.tsx');
    assert.ok(thumb.includes("state === 'loading'"));
    assert.ok(thumb.includes("state === 'processing'"));
    assert.ok(thumb.includes('Preparando visualização'));
  });

  it('viewer usePreviewAsset revoga objectURL no cleanup', () => {
    const asset = readSrc('features/documents/viewer/usePreviewAsset.ts');
    assert.ok(asset.includes('URL.revokeObjectURL'));
    assert.ok(asset.includes('fetchPreviewAssetBlob'));
  });

  it('não usa URL R2 direta — apenas endpoints autenticados do manifest', () => {
    const hook = readSrc('features/documents/preview/useDocumentThumbnail.ts');
    const api = readSrc('features/documents/api/previewManifestApi.ts');
    assert.equal(hook.includes('objectKey'), false);
    assert.equal(hook.includes('presigned'), false);
    assert.ok(api.includes('/preview/manifest'));
    assert.ok(api.includes('authFetch'));
  });

  it('RecentFileCard delega para DocumentFileCard unificado', () => {
    const recent = readSrc('features/library/components/RecentFileCard.tsx');
    assert.ok(recent.includes('DocumentFileCard'));
  });

  it('modo card usa object-cover para preencher o quadro', () => {
    const thumb = readSrc('features/documents/preview/DocumentThumbnail.tsx');
    const fileThumb = readSrc('features/library/components/files/DocumentFileThumbnail.tsx');
    assert.ok(thumb.includes("card: 'object-cover object-center'"));
    assert.ok(thumb.includes("data-thumbnail-fit={size === 'row' ? 'contain' : 'cover'}"));
    assert.equal(fileThumb.includes('p-1.5'), false);
  });
});
