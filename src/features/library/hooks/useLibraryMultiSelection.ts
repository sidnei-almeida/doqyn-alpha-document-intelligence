import type { DocumentListItem } from '@/types/document-library';
import type { LibraryFolder } from '../types/library';
import type { PointerModifiers } from '../utils/explorerSelectionReducer';
import { useExplorerSelection } from './useExplorerSelection';

/**
 * @deprecated Use ExplorerActionsProvider + useExplorerFileActions
 * Mantido para compatibilidade com testes e imports legados.
 */
export function useLibraryMultiSelection(defaultOrderedIds: string[] = []) {
  const selection = useExplorerSelection(defaultOrderedIds);

  return {
    ...selection,
    handleFileClick: (
      document: DocumentListItem,
      orderedIds: string[],
      event?: PointerModifiers,
    ) => selection.interactFile(document, { type: 'activate', modifiers: event }, orderedIds),
    handleFolderClick: (
      folder: LibraryFolder,
      orderedIds: string[],
      event?: PointerModifiers,
    ) => selection.interactFolder(folder, event, orderedIds),
    toggleFileChecked: (document: DocumentListItem, checked: boolean, orderedIds: string[]) => {
      const isSelected = selection.isFileSelected(document.documentId);
      if (checked === isSelected) return;
      selection.interactFile(document, { type: 'toggle' }, orderedIds);
    },
    toggleFolderChecked: (
      folder: LibraryFolder,
      checked: boolean,
      orderedIds: string[],
    ) => {
      const isSelected = selection.isFolderSelected(folder.id);
      if (checked === isSelected) return;
      selection.interactFolder(folder, { metaKey: true }, orderedIds);
    },
  };
}
