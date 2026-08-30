import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * O vazio pequeno — dentro de menu, popover, lista curta, coluna.
 *
 * É o irmão do `EmptyState`, e a diferença é de lugar, não de gosto: aquele ocupa a área de
 * conteúdo de uma tela e ganha respiro, título e ação; este mora dentro de uma peça que já tem
 * moldura própria, e por isso é uma linha e nada mais. Usar o grande aqui empurraria o menu para
 * fora da tela; usar o pequeno lá deixaria a frase perdida no meio do vão.
 *
 * Existe porque a mesma frase vinha escrita de doze jeitos — `text-[11px] text-doqyn-muted` num
 * lugar, `text-label font-normal text-doqyn-subtle` no outro. Ninguém nota um caso isolado; quem
 * cruza três telas em cinco minutos nota todos.
 */
export function EmptyHint({
  children,
  className,
  /** Quando a peça já dá o recuo — célula de tabela, item de lista com padding próprio. */
  bare = false,
}: {
  children: ReactNode;
  className?: string;
  bare?: boolean;
}) {
  return (
    <p
      className={cn(
        'text-caption leading-relaxed text-doqyn-subtle',
        !bare && 'px-3 py-2.5',
        className,
      )}
      role="status"
    >
      {children}
    </p>
  );
}
