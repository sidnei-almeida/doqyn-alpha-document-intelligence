import type { DocumentListItem } from '@/types/document-library';
import type { LibraryFolder, LibrarySelection } from '../types/library';
import { selectRangeIds, toggleIdInSet, type SelectionAnchor } from './librarySelectionUtils';

export type ExplorerSelectionState = {
  selectedFileIds: Set<string>;
  selectedFolderIds: Set<string>;
  anchor: SelectionAnchor | null;
  focus: LibrarySelection;
};

export const initialExplorerSelectionState: ExplorerSelectionState = {
  selectedFileIds: new Set(),
  selectedFolderIds: new Set(),
  anchor: null,
  focus: null,
};

export type PointerModifiers = {
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
};

type SelectFilePayload = {
  document: DocumentListItem;
  orderedIds: string[];
  modifiers?: PointerModifiers;
};

type SelectFolderPayload = {
  folder: LibraryFolder;
  orderedIds: string[];
  modifiers?: PointerModifiers;
};

type ToggleFilePayload = {
  document: DocumentListItem;
  checked: boolean;
  orderedIds: string[];
};

type ToggleFolderPayload = {
  folder: LibraryFolder;
  checked: boolean;
  orderedIds: string[];
};

export type ExplorerSelectionAction =
  | { type: 'clear' }
  | { type: 'select_file'; payload: SelectFilePayload }
  | { type: 'select_folder'; payload: SelectFolderPayload }
  | { type: 'toggle_file'; payload: ToggleFilePayload }
  | { type: 'toggle_folder'; payload: ToggleFolderPayload }
  | { type: 'select_file_only'; payload: { document: DocumentListItem } }
  | {
      type: 'marquee_select';
      payload: { fileIds: string[]; folderIds: string[]; additive: boolean };
    }
  | {
      type: 'restore_selection';
      payload: { fileIds: string[]; folderIds: string[] };
    };

function readModifiers(modifiers?: PointerModifiers) {
  return {
    metaKey: modifiers?.metaKey ?? false,
    ctrlKey: modifiers?.ctrlKey ?? false,
    shiftKey: modifiers?.shiftKey ?? false,
  };
}

/** Clique simples em item já selecionado — remove só esse id (estilo Finder). */
function deselectIdFromSet(
  state: ExplorerSelectionState,
  kind: 'file' | 'folder',
  id: string,
  orderedIds: string[],
): ExplorerSelectionState {
  const selectedKey = kind === 'file' ? 'selectedFileIds' : 'selectedFolderIds';
  const nextIds = new Set(state[selectedKey]);
  nextIds.delete(id);

  const nextFocus =
    state.focus?.kind === kind &&
    (kind === 'file'
      ? state.focus.kind === 'file' && state.focus.document.documentId === id
      : state.focus.kind === 'folder' && state.focus.folder.id === id)
      ? null
      : state.focus;

  const nextAnchor =
    state.anchor?.kind === kind && state.anchor.id === id
      ? (() => {
          const remaining = orderedIds.filter((itemId) => nextIds.has(itemId));
          return remaining[0] ? { kind, id: remaining[0] } : null;
        })()
      : state.anchor;

  return {
    ...state,
    [selectedKey]: nextIds,
    focus: nextFocus,
    anchor: nextAnchor,
  };
}

export function explorerSelectionReducer(
  state: ExplorerSelectionState,
  action: ExplorerSelectionAction,
): ExplorerSelectionState {
  switch (action.type) {
    case 'clear':
      return initialExplorerSelectionState;

    case 'select_file_only': {
      const { document } = action.payload;
      return {
        selectedFileIds: new Set([document.documentId]),
        selectedFolderIds: new Set(),
        anchor: { kind: 'file', id: document.documentId },
        focus: { kind: 'file', document },
      };
    }

    case 'select_file': {
      const { document, orderedIds, modifiers } = action.payload;
      const { metaKey, ctrlKey, shiftKey } = readModifiers(modifiers);
      const id = document.documentId;
      const toggle = metaKey || ctrlKey;

      if (shiftKey && state.anchor?.kind === 'file') {
        return {
          selectedFileIds: new Set(selectRangeIds(orderedIds, state.anchor.id, id)),
          selectedFolderIds: new Set(),
          anchor: state.anchor,
          focus: { kind: 'file', document },
        };
      }

      if (toggle) {
        return {
          selectedFileIds: toggleIdInSet(state.selectedFileIds, id),
          selectedFolderIds: new Set(),
          anchor: { kind: 'file', id },
          focus: { kind: 'file', document },
        };
      }

      if (state.selectedFileIds.has(id)) {
        return deselectIdFromSet(state, 'file', id, orderedIds);
      }

      return {
        selectedFileIds: new Set([id]),
        selectedFolderIds: new Set(),
        anchor: { kind: 'file', id },
        focus: { kind: 'file', document },
      };
    }

    case 'select_folder': {
      const { folder, orderedIds, modifiers } = action.payload;
      const { metaKey, ctrlKey, shiftKey } = readModifiers(modifiers);
      const id = folder.id;
      const toggle = metaKey || ctrlKey;

      if (shiftKey && state.anchor?.kind === 'folder') {
        return {
          selectedFileIds: new Set(),
          selectedFolderIds: new Set(selectRangeIds(orderedIds, state.anchor.id, id)),
          anchor: state.anchor,
          focus: { kind: 'folder', folder },
        };
      }

      if (toggle) {
        return {
          selectedFileIds: new Set(),
          selectedFolderIds: toggleIdInSet(state.selectedFolderIds, id),
          anchor: { kind: 'folder', id },
          focus: { kind: 'folder', folder },
        };
      }

      if (state.selectedFolderIds.has(id)) {
        return deselectIdFromSet(state, 'folder', id, orderedIds);
      }

      return {
        selectedFileIds: new Set(),
        selectedFolderIds: new Set([id]),
        anchor: { kind: 'folder', id },
        focus: { kind: 'folder', folder },
      };
    }

    case 'toggle_file': {
      const { document, checked, orderedIds } = action.payload;
      const id = document.documentId;

      if (checked) {
        return {
          ...state,
          selectedFileIds: new Set([...state.selectedFileIds, id]),
          anchor: { kind: 'file', id },
          focus: { kind: 'file', document },
        };
      }

      const nextFileIds = new Set(state.selectedFileIds);
      nextFileIds.delete(id);
      const nextFocus =
        state.focus?.kind === 'file' && state.focus.document.documentId === id ? null : state.focus;
      const nextAnchor =
        state.anchor?.kind === 'file' && state.anchor.id === id
          ? (() => {
              const remaining = orderedIds.filter((itemId) => itemId !== id);
              return remaining[0] ? { kind: 'file' as const, id: remaining[0] } : null;
            })()
          : state.anchor;

      return {
        ...state,
        selectedFileIds: nextFileIds,
        focus: nextFocus,
        anchor: nextAnchor,
      };
    }

    case 'toggle_folder': {
      const { folder, checked, orderedIds } = action.payload;
      const id = folder.id;

      if (checked) {
        return {
          ...state,
          selectedFolderIds: new Set([...state.selectedFolderIds, id]),
          anchor: { kind: 'folder', id },
          focus: { kind: 'folder', folder },
        };
      }

      const nextFolderIds = new Set(state.selectedFolderIds);
      nextFolderIds.delete(id);
      const nextFocus =
        state.focus?.kind === 'folder' && state.focus.folder.id === id ? null : state.focus;
      const nextAnchor =
        state.anchor?.kind === 'folder' && state.anchor.id === id
          ? (() => {
              const remaining = orderedIds.filter((itemId) => itemId !== id);
              return remaining[0] ? { kind: 'folder' as const, id: remaining[0] } : null;
            })()
          : state.anchor;

      return {
        ...state,
        selectedFolderIds: nextFolderIds,
        focus: nextFocus,
        anchor: nextAnchor,
      };
    }

    case 'marquee_select': {
      const { fileIds, folderIds, additive } = action.payload;

      if (additive) {
        return {
          ...state,
          selectedFileIds: new Set([...state.selectedFileIds, ...fileIds]),
          selectedFolderIds: new Set([...state.selectedFolderIds, ...folderIds]),
          anchor: fileIds[0]
            ? { kind: 'file', id: fileIds[0] }
            : folderIds[0]
              ? { kind: 'folder', id: folderIds[0] }
              : state.anchor,
          focus: state.focus,
        };
      }

      return {
        selectedFileIds: new Set(fileIds),
        selectedFolderIds: new Set(folderIds),
        anchor: fileIds[0]
          ? { kind: 'file', id: fileIds[0] }
          : folderIds[0]
            ? { kind: 'folder', id: folderIds[0] }
            : null,
        focus: null,
      };
    }

    case 'restore_selection': {
      const { fileIds, folderIds } = action.payload;
      return {
        ...state,
        selectedFileIds: new Set(fileIds),
        selectedFolderIds: new Set(folderIds),
      };
    }

    default:
      return state;
  }
}
