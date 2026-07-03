import type { ComponentType } from 'react';
import type { DocumentPreviewManifest } from '@/types/preview-manifest';
import { ImageViewer } from './ImageViewer';
import { PdfPagesViewer } from './PdfPagesViewer';
import { UnsupportedViewer } from './UnsupportedViewer';

export type ViewerComponentProps = {
  manifest: DocumentPreviewManifest;
  className?: string;
  onToolbarStateChange?: (state: ViewerToolbarState) => void;
  onRegisterActions?: (actions: ViewerActions) => void;
};

export type ViewerToolbarState = {
  scale: number;
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  canZoomIn: boolean;
  canZoomOut: boolean;
};

export type ViewerActions = {
  zoomIn: () => void;
  zoomOut: () => void;
  fitWidth: () => void;
  fitPage: () => void;
  previousPage: () => void;
  nextPage: () => void;
  resetZoom?: () => void;
};

export function resolveViewerComponent(
  manifest: DocumentPreviewManifest,
): ComponentType<ViewerComponentProps> {
  if (manifest.viewerType === 'pdf_pages') return PdfPagesViewer;
  if (manifest.viewerType === 'image') return ImageViewer;
  if (manifest.viewerType === 'deep_zoom_image') return UnsupportedViewer;
  return UnsupportedViewer;
}
