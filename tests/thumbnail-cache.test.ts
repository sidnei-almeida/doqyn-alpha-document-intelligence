import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  buildDocumentThumbnailCacheKey,
  clearAllThumbnailCache,
  clearThumbnailCacheForTenant,
  ensureThumbnailObjectUrl,
  getCachedThumbnailUrl,
  getThumbnailCacheMaxItems,
  getThumbnailCacheSize,
} from '../src/features/documents/preview/thumbnailObjectUrlCache';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, '..', 'src');

function readSrc(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), 'utf8');
}

if (typeof URL.createObjectURL !== 'function') {
  let counter = 0;
  URL.createObjectURL = () => `blob:mock-${++counter}`;
  URL.revokeObjectURL = () => undefined;
}

function makeBlob(seed: string): Blob {
  return new Blob([seed], { type: 'image/png' });
}

describe('thumbnailObjectUrlCache', () => {
  it('reutiliza objectURL para a mesma key', () => {
    clearAllThumbnailCache();
    const key = buildDocumentThumbnailCacheKey({
      tenantId: 't1',
      documentId: 'd1',
      versionId: 'v1',
      assetUrl: '/api/thumb',
    });
    const blob = makeBlob('a');
    const first = ensureThumbnailObjectUrl(key, blob);
    const second = ensureThumbnailObjectUrl(key, makeBlob('b'));
    assert.equal(first, second);
    assert.equal(getThumbnailCacheSize(), 1);
  });

  it('versionId diferente gera key diferente', () => {
    clearAllThumbnailCache();
    const base = {
      tenantId: 't1',
      documentId: 'd1',
      assetUrl: '/api/thumb',
    };
    const v1 = ensureThumbnailObjectUrl(
      buildDocumentThumbnailCacheKey({ ...base, versionId: 'v1' }),
      makeBlob('1'),
    );
    const v2 = ensureThumbnailObjectUrl(
      buildDocumentThumbnailCacheKey({ ...base, versionId: 'v2' }),
      makeBlob('2'),
    );
    assert.notEqual(v1, v2);
    assert.equal(getThumbnailCacheSize(), 2);
  });

  it('revoga URLs antigas ao exceder maxItems', () => {
    clearAllThumbnailCache();
    const max = getThumbnailCacheMaxItems();
    const urls: string[] = [];
    for (let index = 0; index < max + 1; index += 1) {
      const key = buildDocumentThumbnailCacheKey({
        tenantId: 't1',
        documentId: `d${index}`,
        versionId: 'v1',
        assetUrl: `/api/thumb/${index}`,
      });
      urls.push(ensureThumbnailObjectUrl(key, makeBlob(String(index))));
    }
    assert.equal(getThumbnailCacheSize(), max);
    assert.equal(getCachedThumbnailUrl(
      buildDocumentThumbnailCacheKey({
        tenantId: 't1',
        documentId: 'd0',
        versionId: 'v1',
        assetUrl: '/api/thumb/0',
      }),
    ), null);
  });

  it('clearThumbnailCacheForTenant remove apenas entradas do tenant', () => {
    clearAllThumbnailCache();
    const keyT1 = buildDocumentThumbnailCacheKey({
      tenantId: 't1',
      documentId: 'd1',
      versionId: 'v1',
      assetUrl: '/a',
    });
    const keyT2 = buildDocumentThumbnailCacheKey({
      tenantId: 't2',
      documentId: 'd1',
      versionId: 'v1',
      assetUrl: '/a',
    });
    ensureThumbnailObjectUrl(keyT1, makeBlob('1'));
    ensureThumbnailObjectUrl(keyT2, makeBlob('2'));
    clearThumbnailCacheForTenant('t1');
    assert.equal(getCachedThumbnailUrl(keyT1), null);
    assert.ok(getCachedThumbnailUrl(keyT2));
  });
});

describe('thumbnail cache — integração frontend', () => {
  it('useDocumentThumbnail usa query keys estáveis com tenantId', () => {
    const hook = readSrc('features/documents/preview/useDocumentThumbnail.ts');
    const keys = readSrc('features/documents/preview/previewQueryKeys.ts');
    assert.ok(hook.includes('previewQueryKeys.manifest'));
    assert.ok(hook.includes('previewQueryKeys.thumbnailBlob'));
    assert.ok(hook.includes('tenantId'));
    assert.ok(keys.includes('document-preview-manifest'));
    assert.ok(keys.includes('document-thumbnail-blob'));
  });

  it('React Query configurado com staleTime alto e sem refetchOnMount', () => {
    const hook = readSrc('features/documents/preview/useDocumentThumbnail.ts');
    const keys = readSrc('features/documents/preview/previewQueryKeys.ts');
    assert.ok(hook.includes('THUMBNAIL_MANIFEST_STALE_MS'));
    assert.ok(hook.includes('thumbnailQueryOptions'));
    assert.ok(keys.includes('refetchOnWindowFocus: false'));
    assert.ok(keys.includes('refetchOnMount: false'));
    assert.ok(keys.includes('30 * 60 * 1000'));
  });

  it('canPreview=false não habilita queries', () => {
    const hook = readSrc('features/documents/preview/useDocumentThumbnail.ts');
    assert.ok(hook.includes('canPreview'));
    assert.ok(hook.includes('shouldLoad'));
    assert.ok(hook.includes('enabled && canPreview'));
  });

  it('manifest processing faz polling; ready não refetch infinito', () => {
    const hook = readSrc('features/documents/preview/useDocumentThumbnail.ts');
    assert.ok(hook.includes("status === 'processing'"));
    assert.ok(hook.includes('4_000'));
    assert.ok(hook.includes('refetchInterval'));
  });

  it('ObjectURL cache integrado sem revogar no unmount do card', () => {
    const hook = readSrc('features/documents/preview/useDocumentThumbnail.ts');
    assert.ok(hook.includes('ensureThumbnailObjectUrl'));
    assert.equal(hook.includes('usePreviewAsset'), false);
    assert.equal(hook.includes('revokeObjectURL'), false);
  });

  it('AuthProvider limpa cache em logout e troca de tenant', () => {
    const auth = readSrc('auth/AuthProvider.tsx');
    assert.ok(auth.includes('clearAllThumbnailCache'));
    assert.ok(auth.includes('clearPreviewCachesForTenant'));
    assert.ok(auth.includes('previousTenantIdRef'));
  });

  it('lazy load via IntersectionObserver permanece ativo', () => {
    const hook = readSrc('features/documents/preview/useDocumentThumbnail.ts');
    assert.ok(hook.includes('IntersectionObserver'));
    assert.ok(hook.includes('visible'));
  });
});

describe('preview cache headers backend', () => {
  it('manifest usa max-age quando ready e no-store quando processing', () => {
    const helper = readFileSync(
      join(process.cwd(), 'server/utils/previewCacheHeaders.ts'),
      'utf8',
    );
    const handler = readFileSync(
      join(process.cwd(), 'api/documents/preview-manifest.ts'),
      'utf8',
    );
    assert.ok(helper.includes('max-age=3600'));
    assert.ok(helper.includes('no-store'));
    assert.ok(handler.includes('setPreviewManifestCacheHeaders'));
    assert.ok(helper.includes('Vary'));
  });

  it('thumbnails usam cache privado immutable', () => {
    const helper = readFileSync(
      join(process.cwd(), 'server/utils/previewCacheHeaders.ts'),
      'utf8',
    );
    const handler = readFileSync(
      join(process.cwd(), 'api/documents/preview-thumbnail.ts'),
      'utf8',
    );
    assert.ok(helper.includes('max-age=86400, immutable'));
    assert.ok(handler.includes('setPreviewAssetCacheHeaders'));
  });
});
