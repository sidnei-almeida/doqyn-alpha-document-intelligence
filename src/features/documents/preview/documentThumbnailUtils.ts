import type { DocumentPreviewManifest } from '@/types/preview-manifest';

/** Resolve URL autenticada da miniatura a partir do manifest (sem expor R2/objectKey). */
export function resolveThumbnailAssetUrl(manifest: DocumentPreviewManifest): string | null {
  if (manifest.status !== 'ready') return null;
  if (!manifest.permissions?.canPreview) return null;

  if (manifest.viewerType === 'pdf_pages' && manifest.pages.length > 0) {
    return manifest.pages[0].thumbnailUrl;
  }

  if (manifest.viewerType === 'image' && manifest.image?.thumbnailUrl) {
    return manifest.image.thumbnailUrl;
  }

  return null;
}

export function isManifestPreviewPending(manifest: DocumentPreviewManifest | undefined): boolean {
  return manifest?.status === 'processing';
}
