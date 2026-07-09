import { useCallback, useMemo, useReducer } from 'react';
import type { DocumentListItem } from '@/types/document-library';
import type { LibraryFolder } from '../types/library';
import {
  explorerSelectionReducer,
  initialExplorerSelectionState,
  type PointerModifiers,
} from '../utils/explorerSelectionReducer';

export type FileInteractIntent =
  | { type: 'activate'; modifiers?: PointerModifiers }
  | { type: 'toggle' }
  | { type: 'context' };

/**
 * Seleção múltipla estilo file explorer — estado via reducer e API unificada `interactFile`.
 */
export function useExplorerSelection(defaultOrderedIds: string[] = []) {
  const [state, dispatch] = useReducer(explorerSelectionReducer, initialExplorerSelectionState);

  const selectedCount = state.selectedFileIds.size + state.selectedFolderIds.size;

  const isFileSelected = useCallback(
    (id: string) => state.selectedFileIds.has(id),
    [state.selectedFileIds],
  );

  const isFolderSelected = useCallback(
    (id: string) => state.selectedFolderIds.has(id),
    [state.selectedFolderIds],
  );

  const clearSelection = useCallback(() => {
    dispatch({ type: 'clear' });
  }, []);

  const selectFile = useCallback((document: DocumentListItem) => {
    dispatch({ type: 'select_file_only', payload: { document } });
  }, []);

  const interactFile = useCallback(
    (document: DocumentListItem, intent: FileInteractIntent, orderedIds?: string[]) => {
      const ids = orderedIds ?? defaultOrderedIds;

      if (intent.type === 'toggle') {
        const checked = !state.selectedFileIds.has(document.documentId);
        dispatch({ type: 'toggle_file', payload: { document, checked, orderedIds: ids } });
        return;
      }

      if (intent.type === 'activate') {
        dispatch({
          type: 'select_file',
          payload: { document, orderedIds: ids, modifiers: intent.modifiers },
        });
        return;
      }

      dispatch({ type: 'select_file_only', payload: { document } });
    },
    [defaultOrderedIds, state.selectedFileIds],
  );

  const interactFolder = useCallback(
    (folder: LibraryFolder, modifiers: PointerModifiers | undefined, orderedIds?: string[]) => {
      dispatch({
        type: 'select_folder',
        payload: { folder, orderedIds: orderedIds ?? defaultOrderedIds, modifiers },
      });
    },
    [defaultOrderedIds],
  );

  const applyMarqueeSelection = useCallback(
    (fileIds: string[], folderIds: string[], additive: boolean) => {
      dispatch({ type: 'marquee_select', payload: { fileIds, folderIds, additive } });
    },
    [],
  );

  const restoreSelection = useCallback((fileIds: string[], folderIds: string[]) => {
    dispatch({ type: 'restore_selection', payload: { fileIds, folderIds } });
  }, []);

  const captureSelectionSnapshot = useCallback(
    () => ({
      fileIds: [...state.selectedFileIds],
      folderIds: [...state.selectedFolderIds],
    }),
    [state.selectedFileIds, state.selectedFolderIds],
  );

  const selectedDocuments = useMemo(
    () => ({ ids: state.selectedFileIds, count: state.selectedFileIds.size }),
    [state.selectedFileIds],
  );

  const selectedFolders = useMemo(
    () => ({ ids: state.selectedFolderIds, count: state.selectedFolderIds.size }),
    [state.selectedFolderIds],
  );

  return {
    focus: state.focus,
    selectedFileIds: state.selectedFileIds,
    selectedFolderIds: state.selectedFolderIds,
    selectedCount,
    selectedDocuments,
    selectedFolders,
    isFileSelected,
    isFolderSelected,
    clearSelection,
    selectFile,
    interactFile,
    interactFolder,
    applyMarqueeSelection,
    restoreSelection,
    captureSelectionSnapshot,
  };
}
