import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import type { ConfirmOptions } from '@/components/confirm/confirmTypes';
import type { DocumentAccessPermissions } from '../api/rulesApi';
import type { GovernanceEdge } from '../utils/governanceConnections';
import {
  diffGovernanceEdges,
  serializeGovernanceEdgeIds,
  type GovernanceEdgeDiff,
} from '../utils/governanceMapDraft';
import {
  createInitialDraftState,
  governanceDraftReducer,
  selectDirty,
  selectPendingCounts,
} from './draftReducer';
import { buildInitialGovernancePositions } from './layout';
import {
  clearDraftFlowLayout,
  loadDraftFlowLayout,
  loadSavedFlowLayout,
  persistDraftFlowLayout,
  persistSavedFlowLayout,
} from './layoutStorage';
import type { FlowPosition, FlowPositionMap } from './types';

type UseGovernanceFlowDraftInput = {
  serverEdges: GovernanceEdge[];
  categoryIds: string[];
  groupIds: string[];
};

/**
 * Estado do canvas de governança (React Flow): edges em rascunho + posições vivas
 * dos cards, com histórico de undo/redo (snapshots), descarte e commit pós-save.
 */
export function useGovernanceFlowDraft({
  serverEdges,
  categoryIds,
  groupIds,
}: UseGovernanceFlowDraftInput) {
  const defaultPositions = useMemo(
    () => buildInitialGovernancePositions(categoryIds, groupIds),
    [categoryIds, groupIds],
  );

  const [state, dispatch] = useReducer(
    governanceDraftReducer,
    undefined,
    () => {
      const saved = { ...defaultPositions, ...pickKnown(loadSavedFlowLayout(), defaultPositions) };
      const draftOverride = pickKnown(loadDraftFlowLayout(), defaultPositions);
      const draft = draftOverride ? { ...saved, ...draftOverride } : null;
      return createInitialDraftState(serverEdges, saved, draft);
    },
  );

  const [saving, setSaving] = useState(false);

  const serverSnapshot = useMemo(
    () => serializeGovernanceEdgeIds(serverEdges),
    [serverEdges],
  );
  const lastSyncedSnapshotRef = useRef(serverSnapshot);

  useEffect(() => {
    if (lastSyncedSnapshotRef.current === serverSnapshot) return;
    dispatch({ type: 'syncServerEdges', edges: serverEdges });
    lastSyncedSnapshotRef.current = serverSnapshot;
  }, [serverEdges, serverSnapshot]);

  // Categorias/grupos criados após o mount entram no estado com a posição padrão,
  // para que arrastá-los também conte como alteração pendente de layout.
  useEffect(() => {
    dispatch({ type: 'registerNodes', positions: defaultPositions });
  }, [defaultPositions]);

  const draftEdges = state.draft.edges;
  const originalEdges = state.original.edges;
  const positions = state.draft.positions;

  const dirty = useMemo(() => selectDirty(state), [state]);
  const pendingCounts = useMemo(() => selectPendingCounts(state), [state]);

  // Draft automático de layout em localStorage — debounce evita I/O a cada frame de drag.
  useEffect(() => {
    if (!dirty) {
      clearDraftFlowLayout();
      return;
    }

    const timer = window.setTimeout(() => {
      persistDraftFlowLayout(positions);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [dirty, positions]);

  const canUndo = state.undoStack.length > 0;
  const canRedo = state.redoStack.length > 0;

  const addEdge = useCallback((categoryId: string, groupId: string) => {
    dispatch({ type: 'addEdge', categoryId, groupId });
  }, []);

  const removeEdge = useCallback((edgeId: string) => {
    dispatch({ type: 'removeEdge', edgeId });
  }, []);

  const updateEdgePermissions = useCallback(
    (edgeId: string, permissions: DocumentAccessPermissions) => {
      dispatch({ type: 'updateEdgePermissions', edgeId, permissions });
    },
    [],
  );

  const beginNodeDrag = useCallback(() => {
    dispatch({ type: 'nodeDragStart' });
  }, []);

  const moveNode = useCallback((nodeId: string, position: FlowPosition) => {
    dispatch({ type: 'moveNode', nodeId, position });
  }, []);

  const endNodeDrag = useCallback(() => {
    dispatch({ type: 'nodeDragEnd' });
  }, []);

  const applyLayout = useCallback((nextPositions: FlowPositionMap) => {
    dispatch({ type: 'applyLayout', positions: nextPositions });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: 'undo' });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: 'redo' });
  }, []);

  const discard = useCallback(() => {
    dispatch({ type: 'discard' });
    clearDraftFlowLayout();
  }, []);

  const commitSaved = useCallback(
    (nextEdges: GovernanceEdge[], savedPositions: FlowPositionMap) => {
      dispatch({ type: 'commitSaved', edges: nextEdges });
      persistSavedFlowLayout(savedPositions);
      clearDraftFlowLayout();
      lastSyncedSnapshotRef.current = serializeGovernanceEdgeIds(nextEdges);
    },
    [],
  );

  const getDiff = useCallback(
    (): GovernanceEdgeDiff => diffGovernanceEdges(originalEdges, draftEdges),
    [draftEdges, originalEdges],
  );

  return {
    originalEdges,
    draftEdges,
    positions,
    defaultPositions,
    dirty,
    pendingCounts,
    canUndo,
    canRedo,
    saving,
    setSaving,
    addEdge,
    removeEdge,
    updateEdgePermissions,
    beginNodeDrag,
    moveNode,
    endNodeDrag,
    applyLayout,
    undo,
    redo,
    discard,
    commitSaved,
    getDiff,
  };
}

/** Filtra um mapa persistido mantendo apenas nodes que ainda existem. */
function pickKnown(
  stored: FlowPositionMap | null,
  known: FlowPositionMap,
): FlowPositionMap | null {
  if (!stored) return null;
  const filtered: FlowPositionMap = {};
  for (const [nodeId, position] of Object.entries(stored)) {
    if (nodeId in known) filtered[nodeId] = position;
  }
  return filtered;
}

export function useUnsavedMapChangesGuard(
  dirty: boolean,
  onDiscard: () => void,
  confirm: (options: ConfirmOptions) => Promise<boolean>,
) {
  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const blocker = useBlocker(dirty);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;

    void (async () => {
      const shouldDiscard = await confirm({
        title: 'Descartar alterações?',
        description: 'Você tem alterações não salvas no mapa de governança.',
        confirmLabel: 'Descartar',
        cancelLabel: 'Continuar editando',
        variant: 'warning',
      });

      if (shouldDiscard) {
        onDiscard();
        blocker.proceed();
        return;
      }

      blocker.reset();
    })();
  }, [blocker, confirm, onDiscard]);
}
