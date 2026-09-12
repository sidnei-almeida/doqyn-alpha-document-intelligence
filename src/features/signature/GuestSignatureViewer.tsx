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
import { useTranslation } from 'react-i18next';

type GuestSignatureViewerProps = {
  manifest: DocumentPreviewManifest;
  payload: SignaturePortalPayload;
  className?: string;
  onDownload?: () => void;
  isDownloading?: boolean;
};

const VIEWER_TYPE_BADGE_KEYS: Record<string, string> = {
  image: 'shared.imageBadge',
  unsupported: 'shared.noPreviewBadge',
};

export function GuestSignatureViewer({
  manifest,
  payload,
  className,
  onDownload,
  isDownloading = false,
}: GuestSignatureViewerProps) {
  const { t } = useTranslation('signature');

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

  const badgeKey = manifest.viewerType ? VIEWER_TYPE_BADGE_KEYS[manifest.viewerType] : undefined;
  const subtitleParts = [
    payload.versionLabel ? t('shared.versionLabel', { version: payload.versionLabel }) : '',
    payload.issuerName,
    manifest.viewerType === 'pdf_pages' ? 'PDF' : badgeKey ? t(badgeKey) : null,
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
      ? t('shared.pageOf', {
          current: viewerToolbar.currentPage,
          total: viewerToolbar.totalPages,
        })
      : undefined;

  const registerViewerActions = useCallback((actions: ViewerActions) => {
    viewerActionsRef.current = actions;
  }, []);

  return (
    <PreviewAssetFetchProvider fetchAsset={fetchSignaturePreviewAssetBlob}>
      <DocumentViewerFrame
        className={cn(
          'h-[min(70vh,720px)] w-full rounded-lg border border-doqyn-border shadow-none lg:h-full',
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
          onPreviousPage: isPdfViewer ? () => viewerActionsRef.current?.previousPage() : undefined,
          onNextPage: isPdfViewer ? () => viewerActionsRef.current?.nextPage() : undefined,
          onDownload: permissions.canDownload && onDownload ? onDownload : undefined,
        }}
      >
        <div
          className="doqyn-secure-viewer flex h-full min-h-0 flex-col"
          data-testid="signature-preview-viewer"
        >
          <p className="shrink-0 border-b border-doqyn-border-subtle bg-doqyn-bg/80 px-4 py-2 text-xs text-doqyn-muted">
            {t('guestSignatureViewer.visualizacaoProtegidaLeiaO')}
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
