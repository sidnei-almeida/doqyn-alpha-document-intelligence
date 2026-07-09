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
  onShowContextInfo?: () => void;
  onShowFolderInfo?: (folder: LibraryFolder) => void;
  onComingSoon: (label: string) => void;
};

const itemClass =
  'explorer-interactive flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-doqyn-text hover:bg-doqyn-surface-hover active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40';

const dangerClass = `${itemClass} text-doqyn-danger`;

function MenuItem({
  label,
  icon,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={danger ? dangerClass : itemClass}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} size={ICON_SIZE.sm} className="shrink-0 text-doqyn-subtle" />
      {label}
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

  const position = {
    left: Math.min(state.x, window.innerWidth - 260),
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
      className="menu-enter fixed z-[90] w-56 overflow-hidden rounded-xl border border-doqyn-border-subtle bg-doqyn-surface py-1.5 shadow-dropdown"
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
            const isFavorite = doc.isFavorite === true;
            return (
              <>
                <MenuItem
                  label="Visualizar"
                  icon="visibility"
                  disabled={!canPreview}
                  onClick={() => run(() => (onPreviewFile ?? onOpenFile)?.(doc))}
                />
                <MenuItem
                  label="Baixar"
                  icon="download"
                  disabled={!canDownload}
                  onClick={() => run(() => onDownloadFile?.(doc))}
                />
                <MenuItem
                  label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                  icon="star"
                  onClick={() => run(() => onToggleFavorite?.(doc))}
                />
                <MenuItem
                  label="Ver detalhes"
                  icon="info"
                  onClick={() => run(() => onSelectFileDetails?.(doc))}
                />
                {canTracking && (
                  <MenuItem
                    label="Ver tracking"
                    icon="history"
                    onClick={() => run(() => onTrackingFile?.(doc))}
                  />
                )}
                <MenuItem label="Atualizar versão" icon="refresh" disabled onClick={() => undefined} />
                <MenuItem
                  label="Mover"
                  icon="drive_file_move"
                  disabled
                  onClick={() => run(() => onComingSoon('Mover'))}
                />
                <MenuItem
                  label="Renomear"
                  icon="edit"
                  disabled
                  onClick={() => run(() => onComingSoon('Renomear'))}
                />
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}
