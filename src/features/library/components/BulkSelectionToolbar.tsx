import { Icon } from '@/components/ui/Icon';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import type { DocumentListItem } from '@/types/document-library';
import { ICON_SIZE } from '@/lib/iconDefaults';

type BulkSelectionToolbarProps = {
  selectedCount: number;
  selectedFileIds: Set<string>;
  documents: DocumentListItem[];
  onClear: () => void;
  onDownload: (docs: DocumentListItem[]) => void;
  onPreview?: (doc: DocumentListItem) => void;
};

function comingSoon(label: string) {
  toast.info(`${label} estará disponível em uma próxima versão.`);
}

/** Toolbar contextual premium — substitui filtros quando há seleção (estilo Drive/Finder). */
export function BulkSelectionToolbar({
  selectedCount,
  selectedFileIds,
  documents,
  onClear,
  onDownload,
  onPreview,
}: BulkSelectionToolbarProps) {
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

  return (
    <div
      className="explorer-selection-toolbar flex flex-1 flex-wrap items-center justify-between gap-3"
      data-testid="explorer-selection-toolbar"
    >
      <div className="flex items-center gap-2">
        <IconButton label="Limpar seleção" onClick={onClear}>
          <Icon name="close" size={ICON_SIZE.sm} />
        </IconButton>
        <p className="text-[13px] font-medium text-doqyn-text">
          {selectedCount} {selectedCount === 1 ? 'item selecionado' : 'itens selecionados'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!canPreviewSingle}
          onClick={() => singleFile && onPreview?.(singleFile)}
        >
          <Icon name="visibility" size={ICON_SIZE.sm} />
          Visualizar
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!canDownloadAny}
          onClick={() => onDownload(selectedDocs)}
        >
          <Icon name="download" size={ICON_SIZE.sm} />
          Baixar
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => comingSoon('Mover para pasta')}>
          <Icon name="drive_file_move" size={ICON_SIZE.sm} />
          Mover
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => comingSoon('Compartilhar')}>
          <Icon name="share" size={ICON_SIZE.sm} />
          Compartilhar
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!singleFile}
          onClick={() => comingSoon('Renomear')}
        >
          <Icon name="edit" size={ICON_SIZE.sm} />
          Renomear
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-doqyn-danger hover:text-doqyn-danger"
          onClick={() => comingSoon('Mover para lixeira')}
        >
          <Icon name="delete" size={ICON_SIZE.sm} />
          Excluir
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => comingSoon('Mais opções')}>
          <Icon name="more_horiz" size={ICON_SIZE.sm} />
          Mais
        </Button>
      </div>
    </div>
  );
}

/** @deprecated Use BulkSelectionToolbar */
export const SelectionToolbar = BulkSelectionToolbar;
