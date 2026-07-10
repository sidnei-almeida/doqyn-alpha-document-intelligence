import { queryClient } from '@/app/queryClient';
import { clearAllPreviewCaches } from '@/features/documents/preview/clearPreviewCaches';
import { clearAllThumbnailCache } from '@/features/documents/preview/thumbnailObjectUrlCache';

/** Limpa caches de dados e previews ao trocar usuário, tenant ou permissões. */
export function clearSessionScopedCaches(): void {
  clearAllThumbnailCache();
  clearAllPreviewCaches();
  queryClient.clear();
}
