import { useEffect, useRef } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Link } from 'react-router-dom';
import type { DocumentListItem } from '@/types/document-library';
import type { LibraryFolder, LibraryViewMode } from '../types/library';
import { ICON_SIZE } from '@/lib/iconDefaults';

export type ExplorerContextMenuState =
  | { kind: 'empty'; x: number; y: number; scope: 'root' | 'folder' }
  | { kind: 'folder'; folder: LibraryFolder; x: number; y: number }
  | { kind: 'file'; document: DocumentListItem; x: number; y: number }
  | null;

type ExplorerContextMenuProps = {
  state: ExplorerContextMenuState;
  onClose: () => void;
  viewMode: LibraryViewMode;
  onViewModeChange: (mode: LibraryViewMode) => void;
  onRefresh: () => void;
  onUpload: () => void;
  onUploadInFolder?: (folder: LibraryFolder) => void;
  onOpenFolder?: (folder: LibraryFolder) => void;
  onOpenFile?: (doc: DocumentListItem) => void;
  onPreviewFile?: (doc: DocumentListItem) => void;
  onDownloadFile?: (doc: DocumentListItem) => void;
  onTrackingFile?: (doc: DocumentListItem) => void;
  onSelectFileDetails?: (doc: DocumentListItem) => void;
  onToggleFavorite?: (doc: DocumentListItem) => void;
  onUpdateDocument?: (doc: DocumentListItem) => void;
  onMoveFile?: (doc: DocumentListItem) => void;
  onShareFile?: (doc: DocumentListItem) => void;
  onRequestSignatureFile?: (doc: DocumentListItem) => void;
  onViewSignaturesFile?: (doc: DocumentListItem) => void;
  onDownloadSignedPdfFile?: (doc: DocumentListItem) => void;
  isTrashView?: boolean;
  isDeactivatedView?: boolean;
  onTrashFile?: (doc: DocumentListItem) => void;
  onRestoreFile?: (doc: DocumentListItem) => void;
  onReactivateFile?: (doc: DocumentListItem) => void;
  onShowContextInfo?: () => void;
  onShowFolderInfo?: (folder: LibraryFolder) => void;
  onComingSoon: (label: string) => void;
};

const itemClass =
  'explorer-interactive flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] text-doqyn-text hover:bg-doqyn-surface-hover active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40';

const fileItemClass = `${itemClass} whitespace-nowrap`;

const dangerClass = `${fileItemClass} text-doqyn-danger`;

function MenuItem({
  label,
  icon,
  onClick,
  disabled,
  danger,
  compact,
  title,
}: {
  label: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  compact?: boolean;
  title?: string;
}) {
  const className = danger ? dangerClass : compact ? fileItemClass : itemClass;
  return (
    <button
      type="button"
      role="menuitem"
      className={className}
      disabled={disabled}
      onClick={onClick}
      title={title ?? (compact ? label : undefined)}
    >
      <Icon name={icon} size={ICON_SIZE.xs} className="shrink-0 text-doqyn-subtle" />
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

/** Menu de contexto unificado do File Explorer (área vazia, pasta, arquivo). */
export function ExplorerContextMenu({
  state,
  onClose,
  viewMode,
  onViewModeChange,
  onRefresh,
  onUpload,
  onUploadInFolder,
  onOpenFolder,
  onOpenFile,
  onPreviewFile,
  onDownloadFile,
  onTrackingFile,
  onSelectFileDetails,
  onToggleFavorite,
  onUpdateDocument,
  onMoveFile,
  onShareFile,
  onRequestSignatureFile,
  onViewSignaturesFile,
  onDownloadSignedPdfFile,
  isTrashView = false,
  isDeactivatedView = false,
  onTrashFile,
  onRestoreFile,
  onReactivateFile,
  onShowContextInfo,
  onShowFolderInfo,
  onComingSoon,
}: ExplorerContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [state, onClose]);

  if (!state) return null;

  const menuWidth = state.kind === 'file' ? 280 : 224;
  const position = {
    left: Math.min(state.x, window.innerWidth - menuWidth - 8),
    top: Math.min(state.y, window.innerHeight - 400),
  };

  const run = (action: () => void) => {
    onClose();
    action();
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Menu de contexto"
      className={
        state.kind === 'file'
          ? 'menu-enter fixed z-[90] min-w-[248px] max-w-[300px] overflow-hidden rounded-xl border border-doqyn-border-subtle bg-doqyn-surface py-1 shadow-dropdown'
          : 'menu-enter fixed z-[90] w-56 overflow-hidden rounded-xl border border-doqyn-border-subtle bg-doqyn-surface py-1.5 shadow-dropdown'
      }
      style={position}
      data-testid="explorer-context-menu"
    >
      {state.kind === 'empty' && (
        <>
          <MenuItem label="Enviar documento" icon="upload" onClick={() => run(onUpload)} />
          {state.scope === 'root' && (
            <Link to="/rules" role="menuitem" className={itemClass} onClick={onClose}>
              <Icon name="add" size={ICON_SIZE.sm} className="text-doqyn-muted" />
              Nova categoria (Regras)
            </Link>
          )}
          {state.scope === 'folder' && (
            <Link to="/rules" role="menuitem" className={itemClass} onClick={onClose}>
              <Icon name="balance" size={ICON_SIZE.sm} className="text-doqyn-muted" />
              Ver regras desta categoria
            </Link>
          )}
          <MenuItem label="Atualizar" icon="refresh" onClick={() => run(onRefresh)} />
          <MenuItem
            label={
              state.scope === 'folder'
                ? 'Ver informações da pasta atual'
                : 'Ver informações'
            }
            icon="info"
            onClick={() => run(() => onShowContextInfo?.())}
          />
          <div className="my-1 border-t border-doqyn-border-subtle" />
          <MenuItem
            label="Visualização em grade"
            icon="grid_view"
            onClick={() => run(() => onViewModeChange('grid'))}
            disabled={viewMode === 'grid'}
          />
          <MenuItem
            label="Visualização em lista"
            icon="view_list"
            onClick={() => run(() => onViewModeChange('list'))}
            disabled={viewMode === 'list'}
          />
        </>
      )}

      {state.kind === 'folder' && (
        <>
          <MenuItem
            label="Abrir"
            icon="folder_open"
            onClick={() => run(() => onOpenFolder?.(state.folder))}
          />
          <MenuItem
            label="Enviar documento nesta pasta"
            icon="upload"
            onClick={() => run(() => onUploadInFolder?.(state.folder))}
          />
          <MenuItem
            label="Ver informações"
            icon="info"
            onClick={() => run(() => onShowFolderInfo?.(state.folder))}
          />
          <Link to="/rules" role="menuitem" className={itemClass} onClick={onClose}>
            <Icon name="balance" size={ICON_SIZE.sm} className="text-doqyn-muted" />
            Ver regras
          </Link>
          <MenuItem label="Renomear categoria" icon="edit" disabled onClick={() => undefined} />
          <MenuItem label="Arquivar categoria" icon="delete" disabled onClick={() => undefined} />
          <p className="px-3 py-1.5 text-[10px] text-doqyn-subtle">Renomear e arquivar: em breve</p>
        </>
      )}

      {state.kind === 'file' && (
        <>
          {(() => {
            const doc = state.document;
            const canPreview = doc.permissions?.canPreview !== false && Boolean(doc.latestVersionId);
            const canDownload = Boolean(doc.permissions?.canDownload && doc.latestVersionId);
            const canTracking = Boolean(doc.permissions?.canViewTracking);
            const canUpdate = Boolean(doc.permissions?.canUpdate);
            const archiveView = isTrashView || isDeactivatedView;
            const canMove = Boolean(canUpdate && onMoveFile && !archiveView);
            const canShare = Boolean(
              doc.permissions?.canShare && onShareFile && !archiveView && !doc.permissions?.sharedViaGrant,
            );
            const hasSignatureActivity = doc.signatureSummary?.status && doc.signatureSummary.status !== 'none';
            const canDownloadSignedPdf = Boolean(
              doc.signatureSummary?.hasSignedPdf &&
                doc.signatureSummary.latestRequestId &&
                onDownloadSignedPdfFile &&
                !archiveView,
            );
            const isFavorite = doc.isFavorite === true;
            return (
              <>
                <MenuItem
                  compact
                  label="Visualizar"
                  icon="visibility"
                  disabled={!canPreview}
                  onClick={() => run(() => (onPreviewFile ?? onOpenFile)?.(doc))}
                />
                <MenuItem
                  compact
                  label="Baixar"
                  icon="download"
                  disabled={!canDownload}
                  onClick={() => run(() => onDownloadFile?.(doc))}
                />
                <MenuItem
                  compact
                  label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                  icon="star"
                  onClick={() => run(() => onToggleFavorite?.(doc))}
                />
                <MenuItem
                  compact
                  label="Ver detalhes"
                  icon="info"
                  onClick={() => run(() => onSelectFileDetails?.(doc))}
                />
                {canTracking && (
                  <MenuItem
                    compact
                    label="Ver tracking"
                    icon="history"
                    onClick={() => run(() => onTrackingFile?.(doc))}
                  />
                )}
                <MenuItem
                  compact
                  label="Atualizar documento"
                  icon="upload"
                  disabled={!canUpdate}
                  onClick={() => run(() => onUpdateDocument?.(doc))}
                />
                <MenuItem
                  compact
                  label="Compartilhar"
                  icon="share"
                  disabled={!canShare}
                  title={
                    doc.permissions?.sharedViaGrant
                      ? 'Você não pode compartilhar um documento recebido por compartilhamento.'
                      : !doc.permissions?.canShare
                        ? 'Você não tem permissão para compartilhar este documento.'
                        : undefined
                  }
                  onClick={() => run(() => onShareFile?.(doc))}
                />
                <MenuItem
                  compact
                  label="Solicitar assinatura"
                  icon="draw"
                  disabled={!canShare}
                  onClick={() => run(() => onRequestSignatureFile?.(doc))}
                />
                {hasSignatureActivity ? (
                  <MenuItem
                    compact
                    label="Ver assinaturas"
                    icon="history_edu"
                    onClick={() => run(() => onViewSignaturesFile?.(doc))}
                  />
                ) : null}
                {canDownloadSignedPdf ? (
                  <MenuItem
                    compact
                    label="Baixar PDF assinado"
                    icon="task"
                    onClick={() => run(() => onDownloadSignedPdfFile?.(doc))}
                  />
                ) : null}
                <MenuItem
                  compact
                  label="Mover"
                  icon="drive_file_move"
                  disabled={!canMove}
                  title={
                    !canUpdate
                      ? 'Você não tem permissão para mover este documento.'
                      : isTrashView
                        ? 'Este documento está na Lixeira e não pode ser movido.'
                        : isDeactivatedView
                          ? 'Este documento está desativado e não pode ser movido.'
                          : undefined
                  }
                  onClick={() => run(() => onMoveFile?.(doc))}
                />
                <MenuItem
                  compact
                  label="Renomear"
                  icon="edit"
                  disabled
                  onClick={() => run(() => onComingSoon('Renomear'))}
                />
                {isTrashView ? (
                  <>
                    <div className="my-1 border-t border-doqyn-border-subtle" />
                    <MenuItem
                      compact
                      label="Restaurar"
                      icon="restore_from_trash"
                      onClick={() => run(() => onRestoreFile?.(doc))}
                    />
                  </>
                ) : isDeactivatedView ? (
                  <>
                    <div className="my-1 border-t border-doqyn-border-subtle" />
                    <MenuItem
                      compact
                      label="Recuperar"
                      icon="replay"
                      onClick={() => run(() => onReactivateFile?.(doc))}
                    />
                  </>
                ) : (
                  canUpdate && (
                    <>
                      <div className="my-1 border-t border-doqyn-border-subtle" />
                      <MenuItem
                        compact
                        label="Mover para lixeira"
                        icon="delete"
                        danger
                        onClick={() => run(() => onTrashFile?.(doc))}
                      />
                    </>
                  )
                )}
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}
