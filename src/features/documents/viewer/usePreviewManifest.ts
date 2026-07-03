import { useQuery } from '@tanstack/react-query';
import { fetchPreviewManifest } from '../api/previewManifestApi';

export function usePreviewManifest(input: {
  documentId: string | null;
  versionId: string | null;
  enabled?: boolean;
}) {
  const enabled = Boolean(input.enabled && input.documentId && input.versionId);

  return useQuery({
    queryKey: ['preview-manifest', input.documentId, input.versionId],
    queryFn: () =>
      fetchPreviewManifest({
        documentId: input.documentId!,
        versionId: input.versionId!,
      }),
    enabled,
    staleTime: 30_000,
  });
}
