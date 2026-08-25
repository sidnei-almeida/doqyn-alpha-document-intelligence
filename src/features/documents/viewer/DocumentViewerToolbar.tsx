import type { ReactNode, RefObject } from 'react';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
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

/** Fio vertical curto entre grupos de controle. */
function ToolDivider() {
  return <span className="mx-1 h-4 w-px shrink-0 bg-doqyn-border-subtle" aria-hidden />;
}

/**
 * Ajuste de enquadramento é ação, não modo: texto curto sem caixa, do mesmo
 * tamanho dos rótulos de registro ao lado.
 */
function ToolTextButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[4px] px-2 text-caption text-doqyn-muted transition-colors hover:text-doqyn-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-doqyn-accent-active/30"
    >
      {icon && <Icon name={icon} size={ICON_SIZE.xs} className="shrink-0" />}
      {label}
    </button>
  );
}

/**
 * Barra do visualizador.
 *
 * Eram quatro botões com caixa e canto de outra família alinhados ao lado do
 * nome do arquivo, e mais seis abaixo para zoom e página — dez superfícies
 * competindo com a folha, que é o conteúdo. Agora a ação é glifo com dica, o
 * enquadramento é texto curto e a contagem de páginas é registro monoespaçado;
 * o que separa os grupos é fio, como no resto do sistema.
 */
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

  const actions: ReactNode[] = [];
  if (permissions?.canDownload && onDownload) {
    actions.push(
      <IconButton
        key="download"
        label="Baixar original"
        disabled={isDownloading}
        onClick={onDownload}
      >
        <Icon
          name={isDownloading ? 'progress_activity' : 'download'}
          size={ICON_SIZE.sm}
          className={cn(isDownloading && 'animate-spin')}
        />
      </IconButton>,
    );
  }
  if (permissions?.canViewTracking && onViewTracking) {
    actions.push(
      <IconButton key="tracking" label="Ver tracking" onClick={onViewTracking}>
        <Icon name="history" size={ICON_SIZE.sm} />
      </IconButton>,
    );
  }
  if (permissions?.canUpdate && onUpdateDocument) {
    actions.push(
      <IconButton key="update" label="Atualizar documento" onClick={onUpdateDocument}>
        <Icon name="upload" size={ICON_SIZE.sm} />
      </IconButton>,
    );
  }

  return (
    <header
      className={cn('viewer-toolbar shrink-0 border-b border-doqyn-border bg-doqyn-bg', className)}
    >
      <div className="flex items-start justify-between gap-4 px-4 py-3 sm:px-5">
        <div className="min-w-0 flex-1">
          {isLoading ? (
            <p className="text-caption text-doqyn-muted">Carregando documento…</p>
          ) : (
            <>
              <TruncatedText
                as="h2"
                id="document-viewer-modal-title"
                className="type-h2 text-doqyn-text"
              >
                {title}
              </TruncatedText>
              {subtitle && (
                <p className="register-label mt-1 truncate text-doqyn-subtle">{subtitle}</p>
              )}
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {actions}
          {actions.length > 0 && onToggleDetails && <ToolDivider />}
          {onToggleDetails && (
            <IconButton
              label={showDetails ? 'Ocultar detalhes' : 'Ver detalhes'}
              aria-pressed={showDetails}
              onClick={onToggleDetails}
              className={cn(showDetails && 'bg-doqyn-surface-hover text-doqyn-primary')}
            >
              <Icon name="info" size={ICON_SIZE.sm} />
            </IconButton>
          )}
          <ToolDivider />
          <IconButton
            ref={closeButtonRef}
            label="Fechar visualização do documento"
            onClick={onClose}
          >
            <Icon name="close" size={ICON_SIZE.sm} />
          </IconButton>
        </div>
      </div>

      {showPdfControls && (
        <div className="flex flex-wrap items-center gap-0.5 border-t border-doqyn-border-subtle px-3 py-1.5 sm:px-4">
          <IconButton label="Diminuir zoom" disabled={!canZoomOut} onClick={onZoomOut}>
            <Icon name="remove" size={ICON_SIZE.xs} />
          </IconButton>
          <IconButton label="Aumentar zoom" disabled={!canZoomIn} onClick={onZoomIn}>
            <Icon name="add" size={ICON_SIZE.xs} />
          </IconButton>

          <ToolDivider />

          <ToolTextButton label="Largura" onClick={onFitWidth} />
          <ToolTextButton label="Página" icon="fullscreen" onClick={onFitPage} />

          {pageLabel && (
            <>
              <ToolDivider />
              <IconButton label="Página anterior" onClick={onPreviousPage}>
                <Icon name="chevron_left" size={ICON_SIZE.xs} />
              </IconButton>
              <span className="min-w-[6.5rem] text-center font-mono text-micro tabular-nums text-doqyn-subtle">
                {pageLabel}
              </span>
              <IconButton label="Próxima página" onClick={onNextPage}>
                <Icon name="chevron_right" size={ICON_SIZE.xs} />
              </IconButton>
            </>
          )}

          {onRefresh && (
            <IconButton label="Atualizar preview" onClick={onRefresh} className="ml-auto">
              <Icon name="refresh" size={ICON_SIZE.xs} />
            </IconButton>
          )}
        </div>
      )}
    </header>
  );
}
