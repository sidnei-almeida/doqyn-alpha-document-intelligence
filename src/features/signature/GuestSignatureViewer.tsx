import { useCallback, useMemo, useRef, useState } from 'react';
import { DocumentViewerFrame } from '@/features/documents/viewer/DocumentViewerFrame';
import { PreviewAssetFetchProvider } from '@/features/documents/viewer/PreviewAssetFetchContext';
import {
  resolveViewerComponent,
  type ViewerActions,
  type ViewerToolbarState,
} from '@/features/documents/viewer/viewerRegistry';
import type { DocumentPreviewManifest } from '@/types/preview-manifest';
import type { SignaturePortalPayload } from '@/features/signature/api/signatureApi';
import { fetchSignaturePreviewAssetBlob } from '@/features/signature/api/signatureApi';
import { cn } from '@/lib/utils';

type GuestSignatureViewerProps = {
  manifest: DocumentPreviewManifest;
  payload: SignaturePortalPayload;
  className?: string;
  onDownload?: () => void;
  isDownloading?: boolean;
};

function viewerTypeBadge(viewerType: string | undefined): string | null {
  if (viewerType === 'pdf_pages') return 'PDF';
  if (viewerType === 'image') return 'Imagem';
  if (viewerType === 'unsupported') return 'Sem preview';
  return null;
}

export function GuestSignatureViewer({
  manifest,
  payload,
  className,
  onDownload,
  isDownloading = false,
}: GuestSignatureViewerProps) {
  const viewerActionsRef = useRef<ViewerActions | null>(null);
  const [viewerToolbar, setViewerToolbar] = useState<ViewerToolbarState>({
    scale: 1,
    currentPage: 1,
    totalPages: 0,
    isLoading: false,
    canZoomIn: true,
    canZoomOut: true,
  });

  const ViewerComponent = useMemo(() => resolveViewerComponent(manifest), [manifest]);
  const isPdfViewer = manifest.viewerType === 'pdf_pages';

  const subtitleParts = [
    payload.versionLabel ? `Versão ${payload.versionLabel}` : '',
    payload.issuerName,
    viewerTypeBadge(manifest.viewerType),
  ].filter(Boolean);
  const subtitle = subtitleParts.join(' • ');

  const permissions = {
    canPreview: manifest.permissions.canPreview,
    canDownload: manifest.permissions.canDownload,
    canViewTracking: false,
    canEditMetadata: false,
    canUpdate: false,
  };

  const pageLabel =
    isPdfViewer && viewerToolbar.totalPages > 0
      ? `Página ${viewerToolbar.currentPage} de ${viewerToolbar.totalPages}`
      : undefined;

  const registerViewerActions = useCallback((actions: ViewerActions) => {
    viewerActionsRef.current = actions;
  }, []);

  return (
    <PreviewAssetFetchProvider fetchAsset={fetchSignaturePreviewAssetBlob}>
      <DocumentViewerFrame
        className={cn(
          'h-[min(70vh,720px)] w-full rounded-lg border border-doqyn-border shadow-none',
          className,
        )}
        toolbar={{
          title: payload.documentName,
          subtitle,
          permissions,
          pageLabel,
          canZoomIn: viewerToolbar.canZoomIn,
          canZoomOut: viewerToolbar.canZoomOut,
          isDownloading,
          onClose: () => undefined,
          onZoomIn: () => viewerActionsRef.current?.zoomIn(),
          onZoomOut: () => viewerActionsRef.current?.zoomOut(),
          onFitWidth: () => viewerActionsRef.current?.fitWidth(),
          onFitPage: () => viewerActionsRef.current?.fitPage(),
          onPreviousPage: isPdfViewer
            ? () => viewerActionsRef.current?.previousPage()
            : undefined,
          onNextPage: isPdfViewer ? () => viewerActionsRef.current?.nextPage() : undefined,
          onDownload: permissions.canDownload && onDownload ? onDownload : undefined,
        }}
      >
        <div className="doqyn-secure-viewer flex h-full min-h-0 flex-col" data-testid="signature-preview-viewer">
          <p className="shrink-0 border-b border-doqyn-border-subtle bg-doqyn-bg/80 px-4 py-2 text-xs text-doqyn-muted">
            Visualização protegida. Leia o documento antes de assinar.
          </p>
          <ViewerComponent
            manifest={manifest}
            onRegisterActions={registerViewerActions}
            onToolbarStateChange={setViewerToolbar}
            className="min-h-0 flex-1"
          />
        </div>
      </DocumentViewerFrame>
    </PreviewAssetFetchProvider>
  );
}
