import { useEffect, type RefObject } from 'react';

/** Fecha painel ao clicar fora de âncora e/ou do painel (suporta portal). */
export function useDismissOnOutside(
  refs: Array<RefObject<HTMLElement | null>>,
  open: boolean,
  onDismiss: () => void,
) {
  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const inside = refs.some((ref) => ref.current?.contains(target));
      if (!inside) onDismiss();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [refs, open, onDismiss]);
}
