import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import type { DocumentListItem } from '@/types/document-library';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { useTranslation } from 'react-i18next';

type BulkSelectionToolbarProps = {
  selectedCount: number;
  selectedFileIds: Set<string>;
  selectedFolderCount: number;
  documents: DocumentListItem[];
  isTrashView?: boolean;
  isDeactivatedView?: boolean;
  onClear: () => void;
  onDownload: (docs: DocumentListItem[]) => void;
  onPreview?: (doc: DocumentListItem) => void;
  onMove?: () => void;
  onTrash?: (documentIds: string[]) => void;
  onRestore?: (documentIds: string[]) => void;
  onReactivate?: (documentIds: string[]) => void;
};

/** Toolbar contextual premium — substitui filtros quando há seleção (estilo Drive/Finder). */
export function BulkSelectionToolbar({
  selectedCount,
  selectedFileIds,
  selectedFolderCount,
  documents,
  isTrashView = false,
  isDeactivatedView = false,
  onClear,
  onDownload,
  onPreview,
  onMove,
  onTrash,
  onRestore,
  onReactivate,
}: BulkSelectionToolbarProps) {
  const { t } = useTranslation('library');

  if (selectedCount === 0) return null;

  const selectedDocs = documents.filter((doc) => selectedFileIds.has(doc.documentId));
  const canDownloadAny = selectedDocs.some(
    (doc) => doc.permissions?.canDownload && doc.latestVersionId,
  );
  const singleFile = selectedDocs.length === 1 ? selectedDocs[0] : null;
  const canPreviewSingle =
    singleFile != null &&
    singleFile.permissions?.canPreview !== false &&
    Boolean(singleFile.latestVersionId);

  const hasFolderSelection = selectedFolderCount > 0;
  const selectedDocumentIds = [...selectedFileIds];
  const canTrashAny = selectedDocs.some((doc) => doc.permissions?.canUpdate !== false);
  const deleteDisabled = hasFolderSelection || selectedDocumentIds.length === 0 || !canTrashAny;
  const deleteTooltip = hasFolderSelection
    ? t('bulkSelectionToolbar.tooltip.foldersCantDelete')
    : !canTrashAny
      ? t('bulkSelectionToolbar.tooltip.noDeletePermission')
      : undefined;
  const archiveView = isTrashView || isDeactivatedView;
  const moveDisabled =
    hasFolderSelection || selectedDocumentIds.length === 0 || !canTrashAny || archiveView;
  const moveTooltip = hasFolderSelection
    ? t('bulkSelectionToolbar.tooltip.onlyDocumentsMove')
    : isTrashView
      ? t('bulkSelectionToolbar.tooltip.trashCantMove')
      : isDeactivatedView
        ? t('bulkSelectionToolbar.tooltip.deactivatedCantMove')
        : !canTrashAny
          ? t('bulkSelectionToolbar.tooltip.noMovePermission')
          : undefined;

  return (
    <div
      className="explorer-selection-toolbar flex flex-1 flex-wrap items-center justify-between gap-3"
      data-testid="explorer-selection-toolbar"
    >
      <div className="flex items-center gap-2.5">
        <span className="font-mono text-micro uppercase tracking-[0.14em] text-doqyn-accent-active">
          {selectedCount} {selectedCount === 1 ? 'selecionado' : 'selecionados'}
        </span>
        <IconButton label={t('bulkSelectionToolbar.limparSelecao')} onClick={onClear}>
          <Icon name="close" size={ICON_SIZE.xs} />
        </IconButton>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {!archiveView && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!canPreviewSingle}
              onClick={() => singleFile && onPreview?.(singleFile)}
            >
              <Icon name="visibility" size={ICON_SIZE.sm} />

              {t('bulkSelectionToolbar.visualizar')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!canDownloadAny}
              onClick={() => onDownload(selectedDocs)}
            >
              <Icon name="download" size={ICON_SIZE.sm} />

              {t('bulkSelectionToolbar.baixar')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={moveDisabled}
              title={moveTooltip}
              onClick={() => onMove?.()}
            >
              <Icon name="drive_file_move" size={ICON_SIZE.sm} />

              {t('bulkSelectionToolbar.mover')}
            </Button>
          </>
        )}

        {isTrashView ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={selectedDocumentIds.length === 0}
            onClick={() => onRestore?.(selectedDocumentIds)}
          >
            <Icon name="restore_from_trash" size={ICON_SIZE.sm} />

            {t('bulkSelectionToolbar.restaurar')}
          </Button>
        ) : isDeactivatedView ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={selectedDocumentIds.length === 0}
            onClick={() => onReactivate?.(selectedDocumentIds)}
          >
            <Icon name="replay" size={ICON_SIZE.sm} />

            {t('bulkSelectionToolbar.recuperar')}
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-doqyn-danger hover:text-doqyn-danger"
            disabled={deleteDisabled}
            title={deleteTooltip}
            onClick={() => onTrash?.(selectedDocumentIds)}
          >
            <Icon name="delete" size={ICON_SIZE.sm} />

            {t('bulkSelectionToolbar.excluir')}
          </Button>
        )}
      </div>
    </div>
  );
}

/** @deprecated Use BulkSelectionToolbar */
export const SelectionToolbar = BulkSelectionToolbar;
