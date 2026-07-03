import { useCallback, useRef, type Ref } from 'react';

type RefItem<T> = Ref<T> | ((node: T | null) => void);

/** Combina refs sem recriar o callback quando refs internas mudam de identidade. */
export function useStableCombinedRef<T>(...refs: RefItem<T>[]) {
  const refsRef = useRef(refs);
  refsRef.current = refs;

  return useCallback((node: T | null) => {
    for (const ref of refsRef.current) {
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref && typeof ref === 'object' && 'current' in ref) {
        (ref as { current: T | null }).current = node;
      }
    }
  }, []);
}
