/** staleTime/gcTime para thumbnails — versões são imutáveis após geradas. */
export const THUMBNAIL_MANIFEST_STALE_MS = 30 * 60 * 1000;
export const THUMBNAIL_MANIFEST_GC_MS = 2 * 60 * 60 * 1000;
export const THUMBNAIL_BLOB_STALE_MS = 30 * 60 * 1000;
export const THUMBNAIL_BLOB_GC_MS = 2 * 60 * 60 * 1000;

export const thumbnailQueryOptions = {
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  retry: 1,
} as const;

export const previewQueryKeys = {
  manifest: (tenantId: string | undefined, documentId: string, versionId: string) =>
    ['document-preview-manifest', tenantId ?? 'unknown', documentId, versionId] as const,

  thumbnailBlob: (
    tenantId: string | undefined,
    documentId: string,
    versionId: string,
    assetUrl: string,
  ) =>
    ['document-thumbnail-blob', tenantId ?? 'unknown', documentId, versionId, assetUrl] as const,
};
