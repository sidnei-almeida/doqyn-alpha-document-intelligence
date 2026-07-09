import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth/useAuth';
import { isThumbnailCandidate } from '@/components/ui/fileTypeUtils';
import { fetchPreviewManifest, fetchPreviewAssetBlob } from '../api/previewManifestApi';
import { isManifestPreviewPending, resolveThumbnailAssetUrl } from './documentThumbnailUtils';
import {
  previewQueryKeys,
  THUMBNAIL_BLOB_GC_MS,
  THUMBNAIL_BLOB_STALE_MS,
  THUMBNAIL_MANIFEST_GC_MS,
  THUMBNAIL_MANIFEST_STALE_MS,
  thumbnailQueryOptions,
} from './previewQueryKeys';
import {
  buildDocumentThumbnailCacheKey,
  ensureThumbnailObjectUrl,
} from './thumbnailObjectUrlCache';

export type DocumentThumbnailState =
  | 'idle'
  | 'loading'
  | 'processing'
  | 'ready'
  | 'error';

type UseDocumentThumbnailInput = {
  fileName: string;
  documentId?: string;
  versionId?: string;
  canPreview?: boolean;
  enabled?: boolean;
};

type UseDocumentThumbnailResult = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  thumbnailUrl: string | null;
  state: DocumentThumbnailState;
};

/** Carrega miniatura via manifest + asset autenticado, com lazy load e cache React Query. */
export function useDocumentThumbnail({
  fileName,
  documentId,
  versionId,
  canPreview = true,
  enabled = true,
}: UseDocumentThumbnailInput): UseDocumentThumbnailResult {
  const { tenant } = useAuth();
  const tenantId = tenant?.tenantId;
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const candidate = isThumbnailCandidate(fileName);

  const shouldLoad = Boolean(
    enabled && canPreview && candidate && documentId && versionId && tenantId,
  );

  useEffect(() => {
    const node = containerRef.current;
    if (!node || !shouldLoad) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { rootMargin: '160px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [shouldLoad]);

  const manifestQuery = useQuery({
    queryKey: previewQueryKeys.manifest(tenantId, documentId!, versionId!),
    queryFn: () =>
      fetchPreviewManifest({
        documentId: documentId!,
        versionId: versionId!,
        trackView: false,
      }),
    enabled: shouldLoad && visible,
    staleTime: THUMBNAIL_MANIFEST_STALE_MS,
    gcTime: THUMBNAIL_MANIFEST_GC_MS,
    ...thumbnailQueryOptions,
    refetchInterval: (query) =>
      query.state.data?.status === 'processing' ? 4_000 : false,
  });

  const manifest = manifestQuery.data;
  const manifestAllowsPreview = manifest?.permissions?.canPreview !== false;

  const assetUrl = useMemo(() => {
    if (!manifest || !manifestAllowsPreview) return null;
    return resolveThumbnailAssetUrl(manifest);
  }, [manifest, manifestAllowsPreview]);

  const blobQuery = useQuery({
    queryKey: previewQueryKeys.thumbnailBlob(tenantId, documentId!, versionId!, assetUrl ?? ''),
    queryFn: () => fetchPreviewAssetBlob(assetUrl!),
    enabled: shouldLoad && visible && Boolean(assetUrl),
    staleTime: THUMBNAIL_BLOB_STALE_MS,
    gcTime: THUMBNAIL_BLOB_GC_MS,
    ...thumbnailQueryOptions,
  });

  const thumbnailUrl = useMemo(() => {
    if (!blobQuery.data || !tenantId || !documentId || !versionId || !assetUrl) return null;
    const cacheKey = buildDocumentThumbnailCacheKey({
      tenantId,
      documentId,
      versionId,
      assetUrl,
    });
    return ensureThumbnailObjectUrl(cacheKey, blobQuery.data);
  }, [assetUrl, blobQuery.data, documentId, tenantId, versionId]);

  const state: DocumentThumbnailState = useMemo(() => {
    if (!shouldLoad || !visible) return 'idle';
    if (manifestQuery.isLoading) return 'loading';
    if (isManifestPreviewPending(manifest)) return 'processing';
    if (manifestQuery.isError || manifest?.status === 'failed') return 'error';
    if (!manifestAllowsPreview) return 'error';
    if (!assetUrl) return 'error';
    if (blobQuery.isLoading || blobQuery.isFetching) return 'loading';
    if (blobQuery.isError) return 'error';
    if (thumbnailUrl) return 'ready';
    return 'loading';
  }, [
    assetUrl,
    blobQuery.isError,
    blobQuery.isFetching,
    blobQuery.isLoading,
    manifest,
    manifestAllowsPreview,
    manifestQuery.isError,
    manifestQuery.isLoading,
    shouldLoad,
    thumbnailUrl,
    visible,
  ]);

  return { containerRef, thumbnailUrl, state };
}
