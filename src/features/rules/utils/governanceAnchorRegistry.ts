export type AnchorUpdateAction = 'skip' | 'assign' | 'remove';

/** Decide se o registro de anchor deve mudar — função pura para testes. */
export function resolveAnchorUpdate(
  previous: HTMLElement | null | undefined,
  next: HTMLElement | null,
): AnchorUpdateAction {
  if (previous === next) return 'skip';
  if (next === null) {
    return previous != null ? 'remove' : 'skip';
  }
  return 'assign';
}

export type AnchorRefFactory = {
  getRef: (id: string) => (node: HTMLElement | null) => void;
  prune: (validIds: Set<string>) => void;
};

export function createAnchorRefFactory(
  anchors: { current: Record<string, HTMLElement | null> },
  onAnchorsChanged: () => void,
): AnchorRefFactory {
  const callbacks = new Map<string, (node: HTMLElement | null) => void>();

  return {
    getRef(id: string) {
      let callback = callbacks.get(id);
      if (!callback) {
        callback = (node: HTMLElement | null) => {
          const action = resolveAnchorUpdate(anchors.current[id], node);
          if (action === 'skip') return;
          if (action === 'remove') {
            delete anchors.current[id];
          } else {
            anchors.current[id] = node;
          }
          onAnchorsChanged();
        };
        callbacks.set(id, callback);
      }
      return callback;
    },
    prune(validIds: Set<string>) {
      let changed = false;
      for (const id of Object.keys(anchors.current)) {
        if (!validIds.has(id)) {
          delete anchors.current[id];
          callbacks.delete(id);
          changed = true;
        }
      }
      if (changed) onAnchorsChanged();
    },
  };
}
