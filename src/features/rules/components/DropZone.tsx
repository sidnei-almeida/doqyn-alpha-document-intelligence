import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';

interface DropZoneProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  activeClassName?: string;
  disabled?: boolean;
  emptyHint?: string;
  dropHint?: string;
  isEmpty?: boolean;
}

export function DropZone({
  id,
  children,
  className,
  activeClassName,
  disabled = false,
  emptyHint,
  dropHint = 'Solte para adicionar ao grupo',
  isEmpty = false,
}: DropZoneProps) {
  const { isOver, setNodeRef } = useDroppable({ id, disabled });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative min-h-[120px] rounded-lg border-2 border-dashed p-3 transition-colors',
        disabled
          ? 'border-doqyn-border-subtle bg-doqyn-bg/20'
          : isOver
            ? cn('border-doqyn-primary bg-doqyn-primary-bg', activeClassName)
            : 'border-doqyn-border bg-doqyn-bg/30',
        className,
      )}
    >
      {isOver && !disabled && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-doqyn-primary-bg">
          <span className="rounded-md bg-doqyn-primary-bg px-3 py-1.5 text-xs font-medium text-doqyn-primary">
            {dropHint}
          </span>
        </div>
      )}
      {isEmpty && emptyHint && !isOver ? (
        <p className="py-6 text-center text-xs text-doqyn-muted">{emptyHint}</p>
      ) : (
        children
      )}
    </div>
  );
}
