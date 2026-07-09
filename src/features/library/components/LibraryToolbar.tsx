import type { DocumentListItem } from '@/types/document-library';
import type { LibraryRouteState } from '../types/library';
import { BulkSelectionToolbar } from './BulkSelectionToolbar';

type LibraryToolbarProps = {
  state: LibraryRouteState;
  selectedCount: number;
  selectedFileIds: Set<string>;
  documents: DocumentListItem[];
  onClearSelection: () => void;
  onBulkDownload: (docs: DocumentListItem[]) => void;
  onPreview?: (doc: DocumentListItem) => void;
};

/** Barra de seleção em massa — filtros e ações principais ficam no header. */
export function LibraryToolbar({
  selectedCount,
  selectedFileIds,
  documents,
  onClearSelection,
  onBulkDownload,
  onPreview,
}: LibraryToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="py-1" data-testid="library-toolbar">
      <BulkSelectionToolbar
        selectedCount={selectedCount}
        selectedFileIds={selectedFileIds}
        documents={documents}
        onClear={onClearSelection}
        onDownload={onBulkDownload}
        onPreview={onPreview}
      />
    </div>
  );
}
