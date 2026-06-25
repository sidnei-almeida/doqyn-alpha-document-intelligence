import { cn } from '@/lib/utils';

interface ListDetailLayoutProps {
  toolbar?: React.ReactNode;
  list: React.ReactNode;
  detail: React.ReactNode;
  className?: string;
}

/**
 * Layout master-detail: toolbar em largura total, lista + painel lateral abaixo.
 * Evita search/filtros na mesma linha visual que o card de detalhes.
 */
export function ListDetailLayout({ toolbar, list, detail, className }: ListDetailLayoutProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {toolbar}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">{list}</div>
        <aside className="min-w-0 lg:sticky lg:top-4">{detail}</aside>
      </div>
    </div>
  );
}
