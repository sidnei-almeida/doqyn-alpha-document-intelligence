import type { DocumentPermissions } from '@/types/document-library';

export type DocumentViewerFitMode = 'width' | 'page' | 'custom';

export type DocumentViewerToolbarState = {
  scale: number;
  fitMode: DocumentViewerFitMode;
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  canZoomIn: boolean;
  canZoomOut: boolean;
};

export type DocumentViewerActions = {
  onClose: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitWidth: () => void;
  onFitPage: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onRefresh?: () => void;
  onDownload?: () => void;
  onViewTracking?: () => void;
  onToggleDetails?: () => void;
  onUpdateDocument?: () => void;
  onEditMetadata?: () => void;
};

export type DocumentViewerPermissionFlags = DocumentPermissions & {
  /** Substitui canEditMetadata quando o backend expuser canUpdate. */
  canUpdate?: boolean;
  canManage?: boolean;
};

export function resolveViewerPermissionFlags(
  permissions: DocumentPermissions,
): DocumentViewerPermissionFlags {
  return {
    ...permissions,
    canUpdate: permissions.canEditMetadata,
    canManage: permissions.canEditMetadata,
  };
}

/** Limite de páginas para renderização completa no MVP. */
export const PDF_FULL_RENDER_PAGE_LIMIT = 40;
