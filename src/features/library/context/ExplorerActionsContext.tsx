import { useCallback, useMemo, type ReactNode } from 'react';
import type { DocumentListItem } from '@/types/document-library';
import type { ExplorerContextMenuState } from '../components/ExplorerContextMenu';
import type { useExplorerSelection } from '../hooks/useExplorerSelection';
import type { FileItemActionHandlers } from '../utils/libraryItemActions';
import {
  ExplorerActionsContext,
  ExplorerFileListScopeContext,
  type ExplorerActionsInternalValue,
} from './explorerActionsContext';

type ExplorerSelectionApi = ReturnType<typeof useExplorerSelection>;

type ExplorerActionsProviderProps = {
  children: ReactNode;
  selection: ExplorerSelectionApi;
  visibleFileIds: string[];
  isStarred: (documentId: string) => boolean;
  onToggleStar: (documentId: string, currentIsFavorite?: boolean) => void;
  onOpenContextMenu: (state: ExplorerContextMenuState) => void;
} & FileItemActionHandlers & {
  onDetails: (doc: DocumentListItem) => void;
};

export function ExplorerActionsProvider({
  children,
  selection,
  visibleFileIds,
  isStarred,
  onToggleStar,
  onOpenContextMenu,
  onOpen,
  onPreview,
  onDownload,
  onDetails,
}: ExplorerActionsProviderProps) {
  const {
    selectedCount,
    selectedFileIds,
    isFileSelected,
    clearSelection,
    selectFile,
    interactFile: interactFileBase,
  } = selection;

  const openFileContextMenu = useCallback(
    (doc: DocumentListItem, x: number, y: number) => {
      if (!selectedFileIds.has(doc.documentId)) {
        selectFile(doc);
      }
      onOpenContextMenu({ kind: 'file', document: doc, x, y });
    },
    [onOpenContextMenu, selectFile, selectedFileIds],
  );

  const value = useMemo<ExplorerActionsInternalValue>(
    () => ({
      defaultOrderedIds: visibleFileIds,
      isFileSelected,
      isStarred,
      interactFile: interactFileBase,
      openFile: onOpen,
      previewFile: onPreview,
      downloadFile: onDownload,
      openFileDetails: onDetails,
      openFileContextMenu,
      toggleStar: (doc) => onToggleStar(doc.documentId, doc.isFavorite),
      selectedCount,
      selectedFileIds,
      clearSelection,
    }),
    [
      visibleFileIds,
      isFileSelected,
      isStarred,
      interactFileBase,
      onOpen,
      onPreview,
      onDownload,
      onDetails,
      openFileContextMenu,
      onToggleStar,
      selectedCount,
      selectedFileIds,
      clearSelection,
    ],
  );

  return (
    <ExplorerActionsContext.Provider value={value}>{children}</ExplorerActionsContext.Provider>
  );
}

/** Ordem visível local para Shift+intervalo em seções (recentes, sem categoria). */
export function ExplorerFileListScope({
  orderedIds,
  children,
}: {
  orderedIds: string[];
  children: ReactNode;
}) {
  return (
    <ExplorerFileListScopeContext.Provider value={orderedIds}>
      {children}
    </ExplorerFileListScopeContext.Provider>
  );
}
