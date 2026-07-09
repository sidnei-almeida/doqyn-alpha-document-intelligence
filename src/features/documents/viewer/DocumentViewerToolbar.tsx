import type { RefObject } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Tooltip } from '@/components/ui/Tooltip';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import type { DocumentViewerPermissionFlags } from './documentViewerTypes';

export type DocumentViewerToolbarProps = {
  title: string;
  subtitle?: string;
  isLoading?: boolean;
  showDetails?: boolean;
  permissions?: DocumentViewerPermissionFlags;
  pageLabel?: string;
  canZoomIn?: boolean;
  canZoomOut?: boolean;
  isDownloading?: boolean;
  onClose: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitWidth?: () => void;
  onFitPage?: () => void;
  onPreviousPage?: () => void;
  onNextPage?: () => void;
  onRefresh?: () => void;
  onDownload?: () => void;
  onViewTracking?: () => void;
  onToggleDetails?: () => void;
  onUpdateDocument?: () => void;
  closeButtonRef?: RefObject<HTMLButtonElement | null>;
  className?: string;
};

export function DocumentViewerToolbar({
  title,
  subtitle,
  isLoading = false,
  showDetails = false,
  permissions,
  pageLabel,
  canZoomIn = true,
  canZoomOut = true,
  isDownloading = false,
  onClose,
  onZoomIn,
  onZoomOut,
  onFitWidth,
  onFitPage,
  onPreviousPage,
  onNextPage,
  onRefresh,
  onDownload,
  onViewTracking,
  onToggleDetails,
  onUpdateDocument,
  closeButtonRef,
  className,
}: DocumentViewerToolbarProps) {
  const showPdfControls = Boolean(onZoomIn && onZoomOut);

  return (
    <header className={cn('viewer-toolbar shrink-0 border-b border-doqyn-border bg-doqyn-bg', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 sm:px-5">
        <div className="min-w-0 flex-1 pr-2">
          {isLoading ? (
            <p className="text-sm text-doqyn-muted">Carregando documento...</p>
          ) : (
            <>
              <TruncatedText
                as="h2"
                id="document-viewer-modal-title"
                className="text-base font-semibold text-doqyn-text sm:text-lg"
              >
                {title}
              </TruncatedText>
              {subtitle && (
                <p className="mt-1 text-xs text-doqyn-muted sm:text-sm">{subtitle}</p>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {permissions?.canDownload && onDownload && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isDownloading}
              onClick={onDownload}
              title="Baixar original"
            >
              {isDownloading ? (
                <Icon name="progress_activity" size={14} className="animate-spin" />
              ) : (
                <Icon name="download" size={14} />
              )}
              <span className="hidden sm:inline">Baixar</span>
            </Button>
          )}
          {permissions?.canViewTracking && onViewTracking && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onViewTracking}
              title="Ver tracking"
            >
              <Icon name="history" size={14} />
              <span className="hidden sm:inline">Tracking</span>
            </Button>
          )}
          {permissions?.canUpdate && onUpdateDocument && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onUpdateDocument}
              title="Atualizar documento"
            >
              <Icon name="upload" size={14} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
          )}
          {onToggleDetails && (
            <Button
              type="button"
              variant={showDetails ? 'primary' : 'ghost'}
              size="sm"
              onClick={onToggleDetails}
              aria-pressed={showDetails}
              title="Detalhes"
            >
              <Icon name="info" size={14} />
              <span className="hidden sm:inline">Detalhes</span>
            </Button>
          )}
          <Tooltip label="Fechar">
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-doqyn-muted transition-colors hover:bg-doqyn-hover hover:text-doqyn-text"
              aria-label="Fechar visualização do documento"
            >
              <Icon name="close" size={ICON_SIZE.md} />
            </button>
          </Tooltip>
        </div>
      </div>

      {showPdfControls && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-doqyn-border-subtle px-4 py-2 sm:px-5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onZoomOut}
            disabled={!canZoomOut}
            title="Diminuir zoom"
            aria-label="Diminuir zoom"
          >
            <Icon name="remove" size={14} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onZoomIn}
            disabled={!canZoomIn}
            title="Aumentar zoom"
            aria-label="Aumentar zoom"
          >
            <Icon name="add" size={14} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onFitWidth}
            title="Ajustar à largura"
          >
            Largura
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onFitPage}
            title="Ajustar à página"
          >
            <Icon name="fullscreen" size={14} />
            Página
          </Button>
          <div className="mx-1 hidden h-5 w-px bg-doqyn-border-subtle sm:block" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onPreviousPage}
            title="Página anterior"
            aria-label="Página anterior"
          >
            <Icon name="chevron_left" size={14} />
          </Button>
          {pageLabel && (
            <span className="min-w-[7rem] text-center text-xs text-doqyn-muted sm:text-sm">
              {pageLabel}
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onNextPage}
            title="Próxima página"
            aria-label="Próxima página"
          >
            <Icon name="chevron_right" size={14} />
          </Button>
          {onRefresh && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              title="Atualizar preview"
              className="ml-auto"
            >
              <Icon name="refresh" size={14} />
            </Button>
          )}
        </div>
      )}
    </header>
  );
}
