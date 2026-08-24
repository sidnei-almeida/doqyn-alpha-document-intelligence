import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/utils';

type OverviewLinkActionProps = {
  children: ReactNode;
  onClick: () => void;
  className?: string;
  showChevron?: boolean;
};

/** Ação secundária dos blocos — texto com chevron, canto de 4px no foco. */
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
        'inline-flex shrink-0 items-center gap-0.5 rounded-[4px] px-1 py-0.5 text-caption font-medium text-doqyn-muted',
        'transition-colors duration-150 hover:text-doqyn-text',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-doqyn-accent-active/30',
        className,
      )}
    >
      {children}
      {showChevron && <Icon name="chevron_right" size={14} aria-hidden />}
    </button>
  );
}
