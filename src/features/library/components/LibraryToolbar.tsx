import type { DocumentListItem } from '@/types/document-library';
import type { LibraryRouteState } from '../types/library';
import { BulkSelectionToolbar } from './BulkSelectionToolbar';

type LibraryToolbarProps = {
  state: LibraryRouteState;
  selectedCount: number;
  selectedFileIds: Set<string>;
  selectedFolderCount: number;
  documents: DocumentListItem[];
  isTrashView?: boolean;
  isDeactivatedView?: boolean;
  onClearSelection: () => void;
  onBulkDownload: (docs: DocumentListItem[]) => void;
  onPreview?: (doc: DocumentListItem) => void;
  onMove?: () => void;
  onTrash?: (documentIds: string[]) => void;
  onRestore?: (documentIds: string[]) => void;
  onReactivate?: (documentIds: string[]) => void;
};

/** Barra de seleção em massa — filtros e ações principais ficam no header. */
export function LibraryToolbar({
  selectedCount,
  selectedFileIds,
  selectedFolderCount,
  documents,
  isTrashView,
  isDeactivatedView,
  onClearSelection,
  onBulkDownload,
  onPreview,
  onMove,
  onTrash,
  onRestore,
  onReactivate,
}: LibraryToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="py-1" data-testid="library-toolbar">
      <BulkSelectionToolbar
        selectedCount={selectedCount}
        selectedFileIds={selectedFileIds}
        selectedFolderCount={selectedFolderCount}
        documents={documents}
        isTrashView={isTrashView}
        isDeactivatedView={isDeactivatedView}
        onClear={onClearSelection}
        onDownload={onBulkDownload}
        onPreview={onPreview}
        onMove={onMove}
        onTrash={onTrash}
        onRestore={onRestore}
        onReactivate={onReactivate}
      />
    </div>
  );
}
