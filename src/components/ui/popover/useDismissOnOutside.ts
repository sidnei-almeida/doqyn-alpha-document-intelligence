import { useEffect, type RefObject } from 'react';
import { useOverlayLayer, useStableCallback } from '@/components/ui/overlayStack';

/**
 * Fecha painel ao clicar fora de âncora e/ou do painel (suporta portal).
 *
 * O popover entra na mesma pilha de camadas dos modais e gavetas. Sem isso, ele
 * escutava o Escape por conta própria enquanto a gaveta de baixo continuava se
 * achando o topo: uma tecla fechava o calendário **e** a gaveta que o abriu.
 * `stopPropagation` não resolveria — não segura outro ouvinte no mesmo nó, que é
 * a razão de a pilha existir.
 *
 * Os dois ouvintes passam por `useStableCallback` porque `refs` chega como array
 * literal novo a cada render e `onDismiss` costuma ser arrow inline. Reassinar
 * todo render é a armadilha que faz a tecla evaporar quando outra camada dispara
 * um render no meio do disparo do evento.
 *
 * Só o Escape consulta o topo. Clique fora continua fechando em qualquer posição
 * da pilha: se algo abriu por cima, clicar nesse algo deve mesmo dispensar o
 * painel de baixo.
 */
export function useDismissOnOutside(
  refs: Array<RefObject<HTMLElement | null>>,
  open: boolean,
  onDismiss: () => void,
) {
  const isTopLayer = useOverlayLayer(open);

  const handlePointerDown = useStableCallback((event: MouseEvent) => {
    const target = event.target as Node;
    const inside = refs.some((ref) => ref.current?.contains(target));
    if (!inside) onDismiss();
  });

  const handleKeyDown = useStableCallback((event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !isTopLayer()) return;
    onDismiss();
  });

  useEffect(() => {
    if (!open) return;

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, handlePointerDown, handleKeyDown]);
}
