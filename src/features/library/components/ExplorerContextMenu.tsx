import { useEffect, useRef } from 'react';
import { isUncategorizedCategory } from '@shared/systemCategory';
import { Icon } from '@/components/ui/Icon';
import { Link } from 'react-router-dom';
import type { DocumentListItem } from '@/types/document-library';
import type { LibraryFolder, LibraryViewMode } from '../types/library';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { VIEW_MODE_ICONS, VIEW_MODE_LABEL_KEYS, VIEW_MODE_ORDER } from '../utils/libraryViewMode';
import { useTranslation } from 'react-i18next';

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
  /** Ficha de metadados do documento — cada tipo tem campos diferentes, então é por documento. */
  onEditMetadataFile?: (doc: DocumentListItem) => void;
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
  onRenameFolder?: (folder: LibraryFolder) => void;
  onDeleteFolder?: (folder: LibraryFolder) => void;
};

// Item de menu é linha de registro, não pílula: canto reto e régua de acento
// à esquerda no hover — a mesma reação do menu do usuário e do `DropdownMenuItem`.
const itemClass =
  'explorer-interactive relative flex w-full items-center gap-2 rounded-none px-3 py-1.5 text-left text-[12px] text-doqyn-text before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-transparent hover:bg-doqyn-hover/50 hover:before:bg-doqyn-accent-active disabled:cursor-not-allowed disabled:opacity-40';

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
  onEditMetadataFile,
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
  onRenameFolder,
  onDeleteFolder,
}: ExplorerContextMenuProps) {
  const { t } = useTranslation('library');

  const menuRef = useRef<HTMLDivElement>(null);

  /**
   * Sem categoria não se renomeia nem se apaga.
   *
   * Ela é o destino de quem perde a pasta: apagá-la deixaria a exclusão da próxima categoria sem
   * para onde mandar os documentos. O servidor recusa de qualquer jeito — aqui é só para a pessoa
   * não descobrir isso depois de clicar.
   */
  const folder = state?.kind === 'folder' ? state.folder : null;
  const isUncategorized = folder ? isUncategorizedCategory(folder) : false;

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
      aria-label={t('explorerContextMenu.menuDeContexto')}
      className={
        state.kind === 'file'
          ? 'menu-enter fixed z-[90] min-w-[248px] max-w-[300px] overflow-hidden rounded-[4px] border border-doqyn-border bg-doqyn-panel py-1 shadow-dropdown'
          : 'menu-enter fixed z-[90] w-56 overflow-hidden rounded-[4px] border border-doqyn-border bg-doqyn-panel py-1.5 shadow-dropdown'
      }
      style={position}
      data-testid="explorer-context-menu"
    >
      {state.kind === 'empty' && (
        <>
          <MenuItem
            label={t('explorerContextMenu.enviarDocumento')}
            icon="upload"
            onClick={() => run(onUpload)}
          />
          {state.scope === 'root' && (
            <Link
              to="/rules?nova=categoria"
              role="menuitem"
              className={itemClass}
              onClick={onClose}
            >
              <Icon name="create_new_folder" size={ICON_SIZE.sm} className="text-doqyn-muted" />

              {t('explorerContextMenu.novaCategoria')}
            </Link>
          )}
          {state.scope === 'folder' && (
            <Link to="/rules" role="menuitem" className={itemClass} onClick={onClose}>
              <Icon name="balance" size={ICON_SIZE.sm} className="text-doqyn-muted" />

              {t('explorerContextMenu.verRegrasDestaCategoria')}
            </Link>
          )}
          <MenuItem
            label={t('explorerContextMenu.atualizar')}
            icon="refresh"
            onClick={() => run(onRefresh)}
          />
          <MenuItem
            label={
              state.scope === 'folder'
                ? t('explorerContextMenu.infoCurrentFolder')
                : t('explorerContextMenu.verInformacoes')
            }
            icon="info"
            onClick={() => run(() => onShowContextInfo?.())}
          />
          <div className="my-1 border-t border-doqyn-border-subtle" />
          {/* O botão do cabeçalho alterna sem nomear; aqui as duas vistas aparecem
              escritas, e é por isto que este caminho continua existindo. Rótulos e
              glifos vêm do mesmo lugar que ele lê, para não divergirem. */}
          {VIEW_MODE_ORDER.map((mode) => (
            <MenuItem
              key={mode}
              label={t(VIEW_MODE_LABEL_KEYS[mode])}
              icon={VIEW_MODE_ICONS[mode]}
              onClick={() => run(() => onViewModeChange(mode))}
              disabled={viewMode === mode}
            />
          ))}
        </>
      )}

      {state.kind === 'folder' && (
        <>
          <MenuItem
            label={t('explorerContextMenu.abrir')}
            icon="folder_open"
            onClick={() => run(() => onOpenFolder?.(state.folder))}
          />
          <MenuItem
            label={t('explorerContextMenu.enviarDocumentoNestaPasta')}
            icon="upload"
            onClick={() => run(() => onUploadInFolder?.(state.folder))}
          />
          <MenuItem
            label={t('explorerContextMenu.verInformacoes')}
            icon="info"
            onClick={() => run(() => onShowFolderInfo?.(state.folder))}
          />
          <Link to="/rules" role="menuitem" className={itemClass} onClick={onClose}>
            <Icon name="balance" size={ICON_SIZE.sm} className="text-doqyn-muted" />

            {t('explorerContextMenu.verRegras')}
          </Link>
          {/* Sem categoria não se renomeia nem se apaga: é o destino de quem perde a pasta, e
              sem ela a exclusão da próxima não teria para onde mandar os documentos. */}
          <MenuItem
            label={t('explorerContextMenu.renomearCategoria')}
            icon="edit"
            disabled={isUncategorized || !onRenameFolder}
            onClick={() => run(() => onRenameFolder?.(state.folder))}
          />
          <MenuItem
            label={t('explorerContextMenu.excluirCategoria')}
            icon="delete"
            danger
            disabled={isUncategorized || !onDeleteFolder}
            onClick={() => run(() => onDeleteFolder?.(state.folder))}
          />
        </>
      )}

      {state.kind === 'file' && (
        <>
          {(() => {
            const doc = state.document;
            const canPreview =
              doc.permissions?.canPreview !== false && Boolean(doc.latestVersionId);
            /**
             * Meio-termo é ação oferecida, não ação bloqueada.
             *
             * `canDownload`/`canShare` significam "pode agora" e vêm falsos quando a governança
             * exige aprovação. Desabilitar aí deixaria o portão do servidor sem campainha: a
             * pessoa tem caminho e não teria como pedir. O clique segue igual — quem responde 409
             * e abre o pedido é o servidor.
             */
            const downloadNeedsApproval = Boolean(doc.permissions?.requiresApproval?.download);
            const canDownload = Boolean(
              (doc.permissions?.canDownload || downloadNeedsApproval) && doc.latestVersionId,
            );
            const canTracking = Boolean(doc.permissions?.canViewTracking);
            const canUpdate = Boolean(doc.permissions?.canUpdate);
            const archiveView = isTrashView || isDeactivatedView;
            const canMove = Boolean(canUpdate && onMoveFile && !archiveView);
            const shareNeedsApproval = Boolean(doc.permissions?.requiresApproval?.share);
            const canShare = Boolean(
              doc.permissions?.canShare &&
              onShareFile &&
              !archiveView &&
              !doc.permissions?.sharedViaGrant,
            );
            // Compartilhar aceita o meio-termo; solicitar assinatura não tem portão e continua
            // preso ao `canShare` estrito — oferecer lá seria prometer um pedido que não existe.
            const canOpenShare = Boolean(
              (doc.permissions?.canShare || shareNeedsApproval) &&
              onShareFile &&
              !archiveView &&
              !doc.permissions?.sharedViaGrant,
            );
            const hasSignatureActivity =
              doc.signatureSummary?.status && doc.signatureSummary.status !== 'none';
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
                  label={t('explorerContextMenu.visualizar')}
                  icon="visibility"
                  disabled={!canPreview}
                  onClick={() => run(() => (onPreviewFile ?? onOpenFile)?.(doc))}
                />
                <MenuItem
                  compact
                  label={t('explorerContextMenu.baixar')}
                  icon="download"
                  disabled={!canDownload}
                  title={
                    downloadNeedsApproval
                      ? t('explorerContextMenu.downloadNeedsApproval')
                      : undefined
                  }
                  onClick={() => run(() => onDownloadFile?.(doc))}
                />
                <MenuItem
                  compact
                  label={t(isFavorite ? 'favorites.remove' : 'favorites.add')}
                  icon="star"
                  onClick={() => run(() => onToggleFavorite?.(doc))}
                />
                <MenuItem
                  compact
                  label={t('explorerContextMenu.verDetalhes')}
                  icon="info"
                  onClick={() => run(() => onSelectFileDetails?.(doc))}
                />
                {canTracking && (
                  <MenuItem
                    compact
                    label={t('explorerContextMenu.verTracking')}
                    icon="history"
                    onClick={() => run(() => onTrackingFile?.(doc))}
                  />
                )}
                <MenuItem
                  compact
                  label={t('explorerContextMenu.atualizarDocumento')}
                  icon="upload"
                  disabled={!canUpdate}
                  onClick={() => run(() => onUpdateDocument?.(doc))}
                />
                <MenuItem
                  compact
                  label={t('explorerContextMenu.compartilhar')}
                  icon="share"
                  disabled={!canOpenShare}
                  title={
                    doc.permissions?.sharedViaGrant
                      ? t('explorerContextMenu.shareReceived')
                      : shareNeedsApproval
                        ? t('explorerContextMenu.shareNeedsApproval')
                        : !doc.permissions?.canShare
                          ? t('explorerContextMenu.noSharePermission')
                          : undefined
                  }
                  onClick={() => run(() => onShareFile?.(doc))}
                />
                <MenuItem
                  compact
                  label={t('explorerContextMenu.solicitarAssinatura')}
                  icon="draw"
                  disabled={!canShare}
                  onClick={() => run(() => onRequestSignatureFile?.(doc))}
                />
                {hasSignatureActivity ? (
                  <MenuItem
                    compact
                    label={t('explorerContextMenu.verAssinaturas')}
                    icon="history_edu"
                    onClick={() => run(() => onViewSignaturesFile?.(doc))}
                  />
                ) : null}
                {canDownloadSignedPdf ? (
                  <MenuItem
                    compact
                    label={t('explorerContextMenu.baixarPdfAssinado')}
                    icon="task"
                    onClick={() => run(() => onDownloadSignedPdfFile?.(doc))}
                  />
                ) : null}
                <MenuItem
                  compact
                  label={t('explorerContextMenu.mover')}
                  icon="drive_file_move"
                  disabled={!canMove}
                  title={
                    !canUpdate
                      ? t('explorerContextMenu.noMovePermission')
                      : isTrashView
                        ? t('explorerContextMenu.inTrashCantMove')
                        : isDeactivatedView
                          ? t('explorerContextMenu.deactivatedCantMove')
                          : undefined
                  }
                  onClick={() => run(() => onMoveFile?.(doc))}
                />
                <MenuItem
                  compact
                  label={t('explorerContextMenu.metadados')}
                  icon="list_alt"
                  disabled={!onEditMetadataFile || archiveView}
                  title={
                    archiveView
                      ? t('explorerContextMenu.archivedNoMetadata')
                      : t('explorerContextMenu.editMetadataHint')
                  }
                  onClick={() => run(() => onEditMetadataFile?.(doc))}
                />
                {isTrashView ? (
                  <>
                    <div className="my-1 border-t border-doqyn-border-subtle" />
                    <MenuItem
                      compact
                      label={t('explorerContextMenu.restaurar')}
                      icon="restore_from_trash"
                      onClick={() => run(() => onRestoreFile?.(doc))}
                    />
                  </>
                ) : isDeactivatedView ? (
                  <>
                    <div className="my-1 border-t border-doqyn-border-subtle" />
                    <MenuItem
                      compact
                      label={t('explorerContextMenu.recuperar')}
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
                        label={t('explorerContextMenu.moverParaLixeira')}
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
