import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/utils';

type OverviewLinkActionProps = {
  children: ReactNode;
  onClick: () => void;
  className?: string;
  showChevron?: boolean;
};

/** Ação secundária discreta nos painéis da Visão Geral. */
export function OverviewLinkAction({
  children,
  onClick,
  className,
  showChevron = true,
}: OverviewLinkActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'overview-link-action inline-flex shrink-0 items-center gap-0.5 rounded-md px-1 py-0.5 text-[12px] font-medium text-doqyn-muted transition-colors duration-150',
        'focus-visible:ring-doqyn-accent-active/20 hover:text-doqyn-text focus-visible:outline-none focus-visible:ring-1',
        className,
      )}
    >
      {children}
      {showChevron && <Icon name="chevron_right" size={14} aria-hidden />}
    </button>
  );
}
