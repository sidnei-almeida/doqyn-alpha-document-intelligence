import { createContext } from 'react';
import type { DocumentListItem } from '@/types/document-library';
import type { FileInteractIntent } from '../hooks/useExplorerSelection';

export type ExplorerActionsInternalValue = {
  defaultOrderedIds: string[];
  isFileSelected: (id: string) => boolean;
  isStarred: (id: string) => boolean;
  interactFile: (
    document: DocumentListItem,
    intent: FileInteractIntent,
    orderedIds: string[],
  ) => void;
  openFile: (doc: DocumentListItem) => void;
  previewFile: (doc: DocumentListItem) => void;
  downloadFile: (doc: DocumentListItem) => void;
  openFileDetails: (doc: DocumentListItem) => void;
  openFileContextMenu: (doc: DocumentListItem, x: number, y: number) => void;
  toggleStar: (doc: DocumentListItem) => void;
  selectedCount: number;
  selectedFileIds: Set<string>;
  clearSelection: () => void;
};

export const ExplorerFileListScopeContext = createContext<string[] | null>(null);

export const ExplorerActionsContext = createContext<ExplorerActionsInternalValue | null>(null);
