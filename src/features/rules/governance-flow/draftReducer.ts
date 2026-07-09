import type { DocumentAccessPermissions } from '../api/rulesApi';
import type { GovernanceEdge } from '../utils/governanceConnections';
import {
  buildEdgeId,
  cloneGovernanceEdges,
  createGovernanceEdge,
  diffGovernanceEdges,
  governanceEdgesEqual,
} from '../utils/governanceMapDraft';
import { countMovedNodes, flowPositionMapsEqual } from './layout';
import type { FlowPosition, FlowPositionMap } from './types';

/** Limite da pilha de undo — snapshots completos (edges + posições). */
export const MAX_HISTORY_SNAPSHOTS = 50;

export type GovernanceMapSnapshot = {
  edges: GovernanceEdge[];
  positions: FlowPositionMap;
};

export type GovernanceDraftState = {
  /** Último estado salvo — referência para dirty e para "Descartar alterações". */
  original: GovernanceMapSnapshot;
  draft: GovernanceMapSnapshot;
  undoStack: GovernanceMapSnapshot[];
  redoStack: GovernanceMapSnapshot[];
  /** Snapshot capturado no início do drag — vira entrada de undo no fim do drag. */
  dragBackup: GovernanceMapSnapshot | null;
};

export type GovernanceDraftAction =
  | { type: 'addEdge'; categoryId: string; groupId: string }
  | { type: 'removeEdge'; edgeId: string }
  | { type: 'updateEdgePermissions'; edgeId: string; permissions: DocumentAccessPermissions }
  | { type: 'nodeDragStart' }
  | { type: 'moveNode'; nodeId: string; position: FlowPosition }
  | { type: 'nodeDragEnd' }
  | { type: 'applyLayout'; positions: FlowPositionMap }
  | { type: 'registerNodes'; positions: FlowPositionMap }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'discard' }
  | { type: 'commitSaved'; edges: GovernanceEdge[] }
  | { type: 'syncServerEdges'; edges: GovernanceEdge[] };

export function clonePositions(positions: FlowPositionMap): FlowPositionMap {
  return Object.fromEntries(
    Object.entries(positions).map(([nodeId, position]) => [nodeId, { ...position }]),
  );
}

export function cloneSnapshot(snapshot: GovernanceMapSnapshot): GovernanceMapSnapshot {
  return {
    edges: cloneGovernanceEdges(snapshot.edges),
    positions: clonePositions(snapshot.positions),
  };
}

export function createInitialDraftState(
  edges: GovernanceEdge[],
  savedPositions: FlowPositionMap,
  draftPositions: FlowPositionMap | null,
): GovernanceDraftState {
  return {
    original: { edges: cloneGovernanceEdges(edges), positions: clonePositions(savedPositions) },
    draft: {
      edges: cloneGovernanceEdges(edges),
      positions: clonePositions(draftPositions ?? savedPositions),
    },
    undoStack: [],
    redoStack: [],
    dragBackup: null,
  };
}

function pushHistory(
  state: GovernanceDraftState,
  snapshot: GovernanceMapSnapshot,
): Pick<GovernanceDraftState, 'undoStack' | 'redoStack'> {
  const undoStack = [...state.undoStack, cloneSnapshot(snapshot)];
  return {
    undoStack:
      undoStack.length > MAX_HISTORY_SNAPSHOTS
        ? undoStack.slice(undoStack.length - MAX_HISTORY_SNAPSHOTS)
        : undoStack,
    redoStack: [],
  };
}

export function governanceDraftReducer(
  state: GovernanceDraftState,
  action: GovernanceDraftAction,
): GovernanceDraftState {
  switch (action.type) {
    case 'addEdge': {
      const edgeId = buildEdgeId(action.categoryId, action.groupId);
      if (state.draft.edges.some((edge) => edge.id === edgeId)) return state;
      return {
        ...state,
        ...pushHistory(state, state.draft),
        draft: {
          ...state.draft,
          edges: [...state.draft.edges, createGovernanceEdge(action.categoryId, action.groupId)],
        },
      };
    }

    case 'removeEdge': {
      if (!state.draft.edges.some((edge) => edge.id === action.edgeId)) return state;
      return {
        ...state,
        ...pushHistory(state, state.draft),
        draft: {
          ...state.draft,
          edges: state.draft.edges.filter((edge) => edge.id !== action.edgeId),
        },
      };
    }

    case 'updateEdgePermissions': {
      if (!state.draft.edges.some((edge) => edge.id === action.edgeId)) return state;
      return {
        ...state,
        ...pushHistory(state, state.draft),
        draft: {
          ...state.draft,
          edges: state.draft.edges.map((edge) =>
            edge.id === action.edgeId
              ? { ...edge, permissions: { ...action.permissions } }
              : edge,
          ),
        },
      };
    }

    case 'nodeDragStart':
      return { ...state, dragBackup: cloneSnapshot(state.draft) };

    case 'moveNode':
      return {
        ...state,
        draft: {
          ...state.draft,
          positions: { ...state.draft.positions, [action.nodeId]: { ...action.position } },
        },
      };

    case 'nodeDragEnd': {
      const backup = state.dragBackup;
      if (!backup) return state;
      if (flowPositionMapsEqual(backup.positions, state.draft.positions)) {
        return { ...state, dragBackup: null };
      }
      return { ...state, ...pushHistory(state, backup), dragBackup: null };
    }

    case 'applyLayout': {
      if (flowPositionMapsEqual(state.draft.positions, action.positions)) return state;
      return {
        ...state,
        ...pushHistory(state, state.draft),
        draft: { ...state.draft, positions: clonePositions(action.positions) },
      };
    }

    case 'registerNodes': {
      // Nodes criados após o mount entram com posição padrão em original E draft
      // (sem histórico) para que movê-los depois conte como alteração pendente.
      const missing = Object.entries(action.positions).filter(
        ([nodeId]) => !(nodeId in state.original.positions),
      );
      if (missing.length === 0) return state;
      const additions = Object.fromEntries(
        missing.map(([nodeId, position]) => [nodeId, { ...position }]),
      );
      return {
        ...state,
        original: {
          ...state.original,
          positions: { ...state.original.positions, ...additions },
        },
        draft: {
          ...state.draft,
          positions: { ...additions, ...state.draft.positions },
        },
      };
    }

    case 'undo': {
      const previous = state.undoStack[state.undoStack.length - 1];
      if (!previous) return state;
      return {
        ...state,
        draft: cloneSnapshot(previous),
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, cloneSnapshot(state.draft)],
      };
    }

    case 'redo': {
      const next = state.redoStack[state.redoStack.length - 1];
      if (!next) return state;
      return {
        ...state,
        draft: cloneSnapshot(next),
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, cloneSnapshot(state.draft)],
      };
    }

    case 'discard':
      return {
        ...state,
        draft: cloneSnapshot(state.original),
        undoStack: [],
        redoStack: [],
        dragBackup: null,
      };

    case 'commitSaved': {
      const saved: GovernanceMapSnapshot = {
        edges: cloneGovernanceEdges(action.edges),
        positions: clonePositions(state.draft.positions),
      };
      return {
        original: saved,
        draft: cloneSnapshot(saved),
        undoStack: [],
        redoStack: [],
        dragBackup: null,
      };
    }

    case 'syncServerEdges': {
      // Mesmo comportamento do draft antigo: só sincroniza quando não há edição pendente de edges.
      if (!governanceEdgesEqual(state.original.edges, state.draft.edges)) return state;
      const edges = cloneGovernanceEdges(action.edges);
      return {
        ...state,
        original: { ...state.original, edges },
        draft: { ...state.draft, edges: cloneGovernanceEdges(edges) },
        undoStack: [],
        redoStack: [],
      };
    }
  }
}

export type GovernancePendingCounts = {
  added: number;
  removed: number;
  moved: number;
  total: number;
};

export function selectPendingCounts(state: GovernanceDraftState): GovernancePendingCounts {
  const { added, removed } = diffGovernanceEdges(state.original.edges, state.draft.edges);
  const moved = countMovedNodes(state.original.positions, state.draft.positions);
  return {
    added: added.length,
    removed: removed.length,
    moved,
    total: added.length + removed.length + moved,
  };
}

export function selectDirty(state: GovernanceDraftState): boolean {
  // Deep-equal contra o último salvo (edges + posições) — mais preciso que flag booleano.
  return (
    !governanceEdgesEqual(state.original.edges, state.draft.edges) ||
    !flowPositionMapsEqual(state.original.positions, state.draft.positions)
  );
}
