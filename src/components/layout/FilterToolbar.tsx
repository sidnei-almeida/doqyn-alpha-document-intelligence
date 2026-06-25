import { cn } from '@/lib/utils';

interface FilterToolbarProps {
  children: React.ReactNode;
  className?: string;
}

/** Barra de filtros/busca em largura total — acima do conteúdo, nunca ao lado do painel de detalhes. */
export function FilterToolbar({ children, className }: FilterToolbarProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-doqyn-border bg-doqyn-surface px-4 py-3',
        className,
      )}
    >
      <div className="flex flex-wrap items-end gap-3">{children}</div>
    </div>
  );
}
