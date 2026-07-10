import { useContext, useMemo } from 'react';
import type { DocumentListItem } from '@/types/document-library';
import type { FileInteractIntent } from '../hooks/useExplorerSelection';
import {
  ExplorerActionsContext,
  ExplorerFileListScopeContext,
} from './explorerActionsContext';

/** Ações de arquivo — lê contexto global; ordem vem do escopo local ou prop. */
export function useExplorerFileActions(localOrderedIds?: string[]) {
  const context = useContext(ExplorerActionsContext);
  if (!context) {
    throw new Error('useExplorerFileActions must be used within ExplorerActionsProvider');
  }

  const scopeIds = useContext(ExplorerFileListScopeContext);
  const orderedIds = localOrderedIds ?? scopeIds ?? context.defaultOrderedIds;

  return useMemo(
    () => ({
      isFileSelected: context.isFileSelected,
      isStarred: context.isStarred,
      interactFile: (document: DocumentListItem, intent: FileInteractIntent) =>
        context.interactFile(document, intent, orderedIds),
      openFile: context.openFile,
      previewFile: context.previewFile,
      downloadFile: context.downloadFile,
      openFileDetails: context.openFileDetails,
      openFileContextMenu: context.openFileContextMenu,
      openSignatures: context.openSignatures,
      toggleStar: context.toggleStar,
      selectedCount: context.selectedCount,
      selectedFileIds: context.selectedFileIds,
      clearSelection: context.clearSelection,
    }),
    [context, orderedIds],
  );
}

/** Seleção para toolbar/header — sem ordem de lista. */
export function useExplorerSelectionState() {
  const context = useContext(ExplorerActionsContext);
  if (!context) {
    throw new Error('useExplorerSelectionState must be used within ExplorerActionsProvider');
  }
  return {
    selectedCount: context.selectedCount,
    selectedFileIds: context.selectedFileIds,
    clearSelection: context.clearSelection,
  };
}
