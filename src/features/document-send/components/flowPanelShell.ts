import { cn } from '@/lib/utils';

export function flowPanelContentClass(embedded?: boolean, className?: string) {
  return cn(
    embedded
      ? 'flow-enter flex min-h-0 w-full flex-col overflow-hidden border-0 bg-transparent shadow-none'
      : 'flow-enter flex min-h-0 flex-col overflow-hidden border-doqyn-border bg-doqyn-surface',
    className,
  );
}
