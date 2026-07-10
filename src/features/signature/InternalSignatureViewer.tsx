import { useCallback, useMemo, useRef, useState } from 'react';
import { DocumentViewerFrame } from '@/features/documents/viewer/DocumentViewerFrame';
import { PreviewAssetFetchProvider } from '@/features/documents/viewer/PreviewAssetFetchContext';
import {
  resolveViewerComponent,
  type ViewerActions,
  type ViewerToolbarState,
} from '@/features/documents/viewer/viewerRegistry';
import type { DocumentPreviewManifest } from '@/types/preview-manifest';
import type { InternalSignatureSigningPayload } from '@/features/signature/api/signatureApi';
import { fetchInternalSignaturePreviewAssetBlob } from '@/features/signature/api/signatureApi';
import { cn } from '@/lib/utils';

type InternalSignatureViewerProps = {
  manifest: DocumentPreviewManifest;
  payload: InternalSignatureSigningPayload;
  className?: string;
};

export function InternalSignatureViewer({
  manifest,
  payload,
  className,
}: InternalSignatureViewerProps) {
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
  ].filter(Boolean);

  const permissions = {
    canPreview: manifest.permissions.canPreview,
    canDownload: false,
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
    <PreviewAssetFetchProvider fetchAsset={fetchInternalSignaturePreviewAssetBlob}>
      <DocumentViewerFrame
        className={cn(
          'h-[min(70vh,720px)] w-full rounded-lg border border-doqyn-border shadow-none',
          className,
        )}
        toolbar={{
          title: payload.documentName,
          subtitle: subtitleParts.join(' • '),
          permissions,
          pageLabel,
          canZoomIn: viewerToolbar.canZoomIn,
          canZoomOut: viewerToolbar.canZoomOut,
          isDownloading: false,
          onClose: () => undefined,
          onZoomIn: () => viewerActionsRef.current?.zoomIn(),
          onZoomOut: () => viewerActionsRef.current?.zoomOut(),
          onFitWidth: () => viewerActionsRef.current?.fitWidth(),
          onFitPage: () => viewerActionsRef.current?.fitPage(),
          onPreviousPage: isPdfViewer
            ? () => viewerActionsRef.current?.previousPage()
            : undefined,
          onNextPage: isPdfViewer ? () => viewerActionsRef.current?.nextPage() : undefined,
        }}
      >
        <div className="doqyn-secure-viewer flex h-full min-h-0 flex-col" data-testid="internal-signature-preview-viewer">
          <p className="shrink-0 border-b border-doqyn-border-subtle bg-doqyn-bg/80 px-4 py-2 text-xs text-doqyn-muted">
            Visualização protegida para assinatura interna.
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
