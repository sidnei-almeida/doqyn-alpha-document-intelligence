import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type FilterBarProps = {
  children: ReactNode;
  className?: string;
  onClear?: () => void;
  showClear?: boolean;
  summary?: ReactNode;
};

/**
 * Barra de filtros — ajuste de vista, não formulário.
 *
 * Era um cartão com borda e fundo próprio em volta de doze campos: a moldura
 * de um formulário de cadastro para uma escolha que só muda o que a lista
 * mostra. Agora os campos flutuam no espaço da página, e a contagem fecha a
 * barra em monoespaçado, como todo número contável do sistema.
 */
export function FilterBar({
  children,
  className,
  onClear,
  showClear = false,
  summary,
}: FilterBarProps) {
  return (
    <div className={cn('shrink-0', className)}>
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
        {children}
      </div>
      {(summary || (showClear && onClear)) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          {showClear && onClear ? (
            <button
              type="button"
              onClick={onClear}
              className="text-caption text-doqyn-primary underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-doqyn-accent-active/30"
            >
              Limpar filtros
            </button>
          ) : (
            <span />
          )}
          <span className="font-mono text-micro tabular-nums text-doqyn-subtle">{summary}</span>
        </div>
      )}
    </div>
  );
}

export type FilterBarFieldProps = {
  children: ReactNode;
  className?: string;
  /** Ocupa 2 colunas no grid responsivo. */
  span?: 1 | 2;
};

export function FilterBarField({ children, className, span = 1 }: FilterBarFieldProps) {
  return <div className={cn(span === 2 && 'sm:col-span-2', className)}>{children}</div>;
}
