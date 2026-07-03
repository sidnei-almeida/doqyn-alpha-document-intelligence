import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import type { ConfirmOptions } from '@/components/confirm/confirmTypes';
import type { GovernanceEdge } from '../utils/governanceConnections';
import {
  cloneGovernanceEdges,
  countGovernanceEdgeChanges,
  createGovernanceEdge,
  diffGovernanceEdges,
  governanceEdgesEqual,
  serializeGovernanceEdgeIds,
  type GovernanceEdgeDiff,
} from '../utils/governanceMapDraft';

export function useGovernanceMapDraft(serverEdges: GovernanceEdge[]) {
  const [originalEdges, setOriginalEdges] = useState(() => cloneGovernanceEdges(serverEdges));
  const [draftEdges, setDraftEdges] = useState(() => cloneGovernanceEdges(serverEdges));
  const [undoStack, setUndoStack] = useState<GovernanceEdge[][]>([]);
  const [saving, setSaving] = useState(false);

  const serverSnapshot = useMemo(
    () => serializeGovernanceEdgeIds(serverEdges),
    [serverEdges],
  );
  const lastSyncedSnapshotRef = useRef(serverSnapshot);

  useEffect(() => {
    if (lastSyncedSnapshotRef.current === serverSnapshot) return;

    const dirty = !governanceEdgesEqual(originalEdges, draftEdges);
    if (!dirty) {
      const cloned = cloneGovernanceEdges(serverEdges);
      setOriginalEdges(cloned);
      setDraftEdges(cloned);
      setUndoStack([]);
    }

    lastSyncedSnapshotRef.current = serverSnapshot;
  }, [draftEdges, originalEdges, serverEdges, serverSnapshot]);

  const dirty = useMemo(
    () => !governanceEdgesEqual(originalEdges, draftEdges),
    [draftEdges, originalEdges],
  );

  const pendingCount = useMemo(
    () => countGovernanceEdgeChanges(originalEdges, draftEdges),
    [draftEdges, originalEdges],
  );

  const canUndo = undoStack.length > 0;

  const applyDraftChange = useCallback((updater: (current: GovernanceEdge[]) => GovernanceEdge[]) => {
    setDraftEdges((current) => {
      const next = updater(current);
      if (next === current) return current;
      setUndoStack((stack) => [...stack, cloneGovernanceEdges(current)]);
      return next;
    });
  }, []);

  const addEdge = useCallback(
    (categoryId: string, groupId: string) => {
      applyDraftChange((current) => {
        const edgeId = `${categoryId}:${groupId}`;
        if (current.some((edge) => edge.id === edgeId)) return current;
        return [...current, createGovernanceEdge(categoryId, groupId)];
      });
    },
    [applyDraftChange],
  );

  const removeEdge = useCallback(
    (edgeId: string) => {
      applyDraftChange((current) => {
        if (!current.some((edge) => edge.id === edgeId)) return current;
        return current.filter((edge) => edge.id !== edgeId);
      });
    },
    [applyDraftChange],
  );

  const undo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const previous = stack[stack.length - 1];
      setDraftEdges(cloneGovernanceEdges(previous));
      return stack.slice(0, -1);
    });
  }, []);

  const discard = useCallback(() => {
    setDraftEdges(cloneGovernanceEdges(originalEdges));
    setUndoStack([]);
  }, [originalEdges]);

  const commitSaved = useCallback((nextEdges: GovernanceEdge[]) => {
    const cloned = cloneGovernanceEdges(nextEdges);
    setOriginalEdges(cloned);
    setDraftEdges(cloned);
    setUndoStack([]);
    lastSyncedSnapshotRef.current = serializeGovernanceEdgeIds(cloned);
  }, []);

  const getDiff = useCallback(
    (): GovernanceEdgeDiff => diffGovernanceEdges(originalEdges, draftEdges),
    [draftEdges, originalEdges],
  );

  return {
    originalEdges,
    draftEdges,
    dirty,
    pendingCount,
    canUndo,
    saving,
    setSaving,
    addEdge,
    removeEdge,
    undo,
    discard,
    commitSaved,
    getDiff,
  };
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
