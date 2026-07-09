import { useCallback, useContext, useEffect } from 'react';
import { MarqueeRegistryContext } from '../context/marqueeSelectionContext';
import type { SelectableKind } from '../utils/marqueeSelectionUtils';

/** Registra card/linha/pasta no registry de marquee selection. */
export function useSelectableItemRef(id: string, kind: SelectableKind) {
  const registry = useContext(MarqueeRegistryContext);

  const ref = useCallback(
    (node: HTMLElement | null) => {
      registry?.register(id, kind, node);
    },
    [id, kind, registry],
  );

  useEffect(() => {
    return () => {
      registry?.register(id, kind, null);
    };
  }, [id, kind, registry]);

  return ref;
}
