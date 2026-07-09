import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { emitClientTrackingEvent } from '@/features/tracking/api/trackingClientEvents';
import type { DocumentVersionSummary } from '@/types/document-library';
import {
  fetchDocumentDownloadBlob,
  triggerBlobDownload,
} from '../api/documentsApi.blobs';
import { getPreviewErrorMessage, getPreviewStatusLabel } from '../utils/previewErrors';
import { showApiErrorToast } from '@/shared/feedback/appFeedback';
import { useDocumentDetail } from '../hooks/useDocuments';
import { DocumentApiError } from '../api/documentsApi.errors';
import { DocumentViewerDetailsPanel } from '../components/DocumentViewerDetailsPanel';
import { DocumentViewerShell } from './DocumentViewerShell';
import { usePreviewManifest } from './usePreviewManifest';
import { resolveViewerComponent, type ViewerActions } from './viewerRegistry';

export type DocumentViewerModalProps = {
  open: boolean;
  documentId: string | null;
  initialVersionId?: string | null;
  initialShowDetails?: boolean;
  onClose: () => void;
  onUpdateDocument?: (documentId: string) => void;
};

function viewerTypeBadge(viewerType: string | undefined): string | null {
  if (viewerType === 'pdf_pages') return 'PDF';
  if (viewerType === 'image') return 'Imagem';
  if (viewerType === 'unsupported') return 'Sem preview';
  return null;
}

export function DocumentViewerModal({
  open,
  documentId,
  initialVersionId,
  initialShowDetails = false,
  onClose,
  onUpdateDocument,
}: DocumentViewerModalProps) {
  const navigate = useNavigate();
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const viewerActionsRef = useRef<ViewerActions | null>(null);

  const [showDetails, setShowDetails] = useState(initialShowDetails);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(initialVersionId ?? null);

  useEffect(() => {
    if (!open) return;
    setShowDetails(initialShowDetails);
    setSelectedVersionId(initialVersionId ?? null);
    viewerActionsRef.current = null;
  }, [open, documentId, initialShowDetails, initialVersionId]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [viewerToolbar, setViewerToolbar] = useState({
    scale: 1,
    currentPage: 1,
    totalPages: 0,
    isLoading: false,
    canZoomIn: true,
    canZoomOut: true,
  });

  const { data, isLoading, error } = useDocumentDetail(open ? documentId : null);

  const activeVersionId = useMemo(() => {
    if (!data) return null;
    return selectedVersionId ?? data.latestVersion?.versionId ?? data.document.latestVersionId ?? null;
  }, [data, selectedVersionId]);

  const activeVersion = data?.versions.find(
    (version: DocumentVersionSummary) => version.versionId === activeVersionId,
  ) ?? null;

  const displayName =
    activeVersion?.finalFileName ??
    data?.document.currentFileName ??
    data?.document.displayName ??
    'Documento';

  const canPreview = Boolean(data?.permissions.canPreview && activeVersionId);

  const manifestQuery = usePreviewManifest({
    documentId,
    versionId: activeVersionId,
    enabled: open && canPreview,
  });

  const manifest = manifestQuery.data;
  const ViewerComponent = manifest ? resolveViewerComponent(manifest) : null;
  const isPdfViewer = manifest?.viewerType === 'pdf_pages';

  useEffect(() => {
    if (!open || !documentId) return;

    const versionId = activeVersionId ?? undefined;
    emitClientTrackingEvent({
      action: 'document.viewer_opened',
      documentId,
      versionId,
      metadata: { source: 'viewer_modal' },
    });

    return () => {
      emitClientTrackingEvent({
        action: 'document.viewer_closed',
        documentId,
        versionId,
        metadata: { source: 'viewer_modal' },
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- abre/fecha apenas com modal; versão é snapshot no evento
  }, [open, documentId]);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  const showProtectedNotice = useMemo(() => {
    const canPreview = manifest?.permissions.canPreview ?? data?.permissions.canPreview ?? false;
    const canDownload = manifest?.permissions.canDownload ?? data?.permissions.canDownload ?? false;
    return canPreview && !canDownload;
  }, [manifest, data]);

  useEffect(() => {
    if (!open || !showProtectedNotice) return;

    const handlePrintShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        toast.info('A impressão deste documento não está disponível para seu perfil.');
        if (documentId) {
          emitClientTrackingEvent({
            action: 'document.print_attempt_blocked',
            documentId,
            versionId: activeVersionId ?? undefined,
            metadata: { source: 'viewer_modal' },
          });
        }
      }
    };

    window.addEventListener('keydown', handlePrintShortcut);
    return () => window.removeEventListener('keydown', handlePrintShortcut);
  }, [open, showProtectedNotice, documentId, activeVersionId]);

  const detailErrorMessage = useMemo(() => {
    if (!error) return null;
    if (error instanceof DocumentApiError) return getPreviewErrorMessage(error);
    if (error instanceof Error) return error.message;
    return 'Não foi possível carregar o documento.';
  }, [error]);

  const manifestErrorMessage = useMemo(() => {
    if (!manifestQuery.error) return null;
    if (manifestQuery.error instanceof DocumentApiError) {
      return getPreviewErrorMessage(manifestQuery.error);
    }
    if (manifestQuery.error instanceof Error) return manifestQuery.error.message;
    return 'Não foi possível carregar o preview.';
  }, [manifestQuery.error]);

  const handleDownload = useCallback(async () => {
    const canDownload = manifest?.permissions.canDownload ?? data?.permissions.canDownload;
    if (!documentId || !activeVersionId || !canDownload || isDownloading) return;

    setIsDownloading(true);
    try {
      const { blob, fileName } = await fetchDocumentDownloadBlob({
        documentId,
        versionId: activeVersionId,
      });
      triggerBlobDownload(blob, fileName);
    } catch (downloadError) {
      showApiErrorToast(downloadError, 'Não foi possível baixar o documento.');
    } finally {
      setIsDownloading(false);
    }
  }, [
    documentId,
    activeVersionId,
    manifest?.permissions.canDownload,
    data?.permissions.canDownload,
    isDownloading,
  ]);

  const handleViewTracking = useCallback(() => {
    if (!documentId) return;
    navigate(`/tracking?documentId=${encodeURIComponent(documentId)}`);
  }, [documentId, navigate]);

  const handleUpdateDocument = useCallback(() => {
    if (!documentId) return;
    if (onUpdateDocument) {
      onUpdateDocument(documentId);
      return;
    }
    navigate(`/biblioteca?updateVersion=${encodeURIComponent(documentId)}`);
  }, [documentId, navigate, onUpdateDocument]);

  const registerViewerActions = useCallback((actions: ViewerActions) => {
    viewerActionsRef.current = actions;
  }, []);

  if (!open || !documentId) return null;

  const categoryLabel = data?.document.categoryName ?? data?.document.documentType ?? '—';
  const versionLabel = activeVersion?.versionLabel ?? (activeVersionId ? '—' : '');
  const previewStatusLabel = getPreviewStatusLabel(
    activeVersion?.preview?.status ?? data?.document.preview?.status,
  );
  const typeBadge = viewerTypeBadge(manifest?.viewerType);
  const subtitleParts = [
    categoryLabel,
    versionLabel ? `Versão ${versionLabel}` : '',
    previewStatusLabel,
    typeBadge,
  ].filter(Boolean);
  const subtitle = subtitleParts.join(' • ');

  const pageLabel =
    isPdfViewer && viewerToolbar.totalPages > 0
      ? `Página ${viewerToolbar.currentPage} de ${viewerToolbar.totalPages}`
      : undefined;

  const permissions = manifest?.permissions
    ? {
        canPreview: manifest.permissions.canPreview,
        canDownload: manifest.permissions.canDownload,
        canViewTracking: manifest.permissions.canViewTracking,
        canEditMetadata: manifest.permissions.canUpdate,
        canUpdate: manifest.permissions.canUpdate,
      }
    : {
        canPreview: data?.permissions.canPreview ?? false,
        canDownload: data?.permissions.canDownload ?? false,
        canViewTracking: data?.permissions.canViewTracking ?? false,
        canEditMetadata: data?.permissions.canEditMetadata ?? false,
        canUpdate: data?.permissions.canUpdate ?? data?.permissions.canEditMetadata ?? false,
      };

  const showProtectedNoticeResolved = permissions.canPreview && !permissions.canDownload;

  const renderViewerContent = () => {
    if (isLoading || manifestQuery.isLoading) {
      return (
        <div className="viewer-canvas flex h-full items-center justify-center text-sm text-doqyn-muted">
          Carregando preview do documento...
        </div>
      );
    }

    if (error || !data) {
      return (
        <div className="viewer-canvas flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm text-doqyn-danger">
            {detailErrorMessage ?? 'Não foi possível carregar o documento.'}
          </p>
        </div>
      );
    }

    if (!data.permissions.canPreview) {
      return (
        <div className="viewer-canvas flex h-full items-center justify-center px-6 text-center">
          <p className="text-sm text-doqyn-muted">
            Você não tem permissão para visualizar este documento.
          </p>
        </div>
      );
    }

    if (!activeVersionId) {
      return (
        <div className="viewer-canvas flex h-full items-center justify-center px-6 text-center">
          <p className="text-sm text-doqyn-muted">Versão não disponível para visualização.</p>
        </div>
      );
    }

    if (manifestQuery.isError) {
      return (
        <div className="viewer-canvas flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm text-doqyn-danger">
            {manifestErrorMessage ?? 'Não foi possível carregar o manifest de preview.'}
          </p>
        </div>
      );
    }

    if (!manifest || !ViewerComponent) {
      return (
        <div className="viewer-canvas flex h-full items-center justify-center px-6 text-center">
          <p className="text-sm text-doqyn-muted">Preview indisponível.</p>
        </div>
      );
    }

    return (
      <div className="doqyn-secure-viewer flex h-full min-h-0 flex-col">
        {showProtectedNoticeResolved && (
          <p className="shrink-0 border-b border-doqyn-border-subtle bg-doqyn-bg/80 px-4 py-2 text-xs text-doqyn-muted">
            Visualização protegida. Download indisponível para seu perfil.
          </p>
        )}
        <ViewerComponent
          manifest={manifest}
          onRegisterActions={registerViewerActions}
          onToolbarStateChange={setViewerToolbar}
          className="min-h-0 flex-1"
        />
      </div>
    );
  };

  const showPageControls = isPdfViewer;

  return (
    <DocumentViewerShell
      overlayRef={overlayRef}
      dialogRef={dialogRef}
      onOverlayClick={onClose}
      showDetails={showDetails}
      detailsPanel={
        data ? (
          <DocumentViewerDetailsPanel
            data={data}
            activeVersionId={activeVersionId}
            activeVersion={activeVersion}
            displayName={displayName}
            onSelectVersion={setSelectedVersionId}
          />
        ) : null
      }
      toolbar={{
        title: displayName,
        subtitle: isLoading ? undefined : subtitle,
        isLoading: isLoading || manifestQuery.isLoading,
        showDetails,
        permissions,
        pageLabel: showPageControls ? pageLabel : undefined,
        canZoomIn: viewerToolbar.canZoomIn,
        canZoomOut: viewerToolbar.canZoomOut,
        isDownloading,
        onClose,
        closeButtonRef,
        onZoomIn: () => viewerActionsRef.current?.zoomIn(),
        onZoomOut: () => viewerActionsRef.current?.zoomOut(),
        onFitWidth: () => viewerActionsRef.current?.fitWidth(),
        onFitPage: () => viewerActionsRef.current?.fitPage(),
        onPreviousPage: showPageControls
          ? () => viewerActionsRef.current?.previousPage()
          : undefined,
        onNextPage: showPageControls ? () => viewerActionsRef.current?.nextPage() : undefined,
        onRefresh: canPreview ? () => void manifestQuery.refetch() : undefined,
        onDownload: permissions.canDownload ? () => void handleDownload() : undefined,
        onViewTracking: permissions.canViewTracking ? handleViewTracking : undefined,
        onToggleDetails: () => setShowDetails((current) => !current),
        onUpdateDocument: permissions.canUpdate ? handleUpdateDocument : undefined,
      }}
    >
      {renderViewerContent()}
    </DocumentViewerShell>
  );
}
