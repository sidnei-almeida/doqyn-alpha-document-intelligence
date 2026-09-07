import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  /** Aceita marcação: parte dos vazios aponta para outra tela, e o link é parte da frase. */
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  stretch?: boolean;
}

/**
 * Aviso de lista vazia — sem moldura.
 *
 * Era um bloco preenchido de canto arredondado no meio da tela: uma caixa em
 * volta de uma frase, quando o que sobra na tela já separa o aviso de tudo o
 * mais. Quando não há ícone, o fio curto acima faz o papel de marca.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  stretch = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center px-8 py-14 text-center',
        // Sem `stretch`, o aviso se centraliza no espaço que tem — é o caso das listas curtas.
        !stretch && 'justify-center',
        /**
         * Com `stretch`, ancora perto do topo em vez de flutuar no meio.
         *
         * Centralizar dentro de uma área de conteúdo que ocupa a tela inteira jogava a frase para o
         * meio de um vão de novecentos pixels, longe das abas que a explicam e sem nada em volta —
         * lia como página quebrada, não como lista vazia. Ancorada, ela aparece onde a lista
         * apareceria.
         */
        stretch && 'min-h-[320px] flex-1 justify-start pt-16',
        className,
      )}
      role="status"
    >
      {icon ? (
        <div className="mb-4 flex items-center justify-center text-doqyn-border-strong">{icon}</div>
      ) : (
        <div className="mb-5 h-px w-10 bg-doqyn-border-subtle" aria-hidden />
      )}
      <p className="text-label font-medium text-doqyn-text">{title}</p>
      {description && (
        <p className="caption-text mt-1.5 max-w-[42ch] leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
