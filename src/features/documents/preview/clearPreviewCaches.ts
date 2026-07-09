import { queryClient } from '@/app/queryClient';
import { clearAllThumbnailCache, clearThumbnailCacheForTenant } from './thumbnailObjectUrlCache';

const PREVIEW_QUERY_ROOTS = new Set([
  'document-preview-manifest',
  'document-thumbnail-blob',
  'preview-manifest',
]);

function isPreviewQueryKey(queryKey: unknown): boolean {
  return Array.isArray(queryKey) && PREVIEW_QUERY_ROOTS.has(String(queryKey[0]));
}

export function clearPreviewQueryCache(): void {
  queryClient.removeQueries({
    predicate: (query) => isPreviewQueryKey(query.queryKey),
  });
}

export function clearPreviewCachesForTenant(tenantId: string): void {
  clearThumbnailCacheForTenant(tenantId);
  queryClient.removeQueries({
    predicate: (query) => {
      if (!isPreviewQueryKey(query.queryKey)) return false;
      return query.queryKey[1] === tenantId;
    },
  });
}

export function clearAllPreviewCaches(): void {
  clearAllThumbnailCache();
  clearPreviewQueryCache();
}
