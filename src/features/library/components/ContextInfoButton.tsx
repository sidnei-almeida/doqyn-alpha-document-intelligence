import { useRef } from 'react';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/utils';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { Tooltip } from '@/components/ui/Tooltip';
import { AnchoredPopover } from '@/components/ui/popover/AnchoredPopover';
import type { LibraryFolder } from '../types/library';
import { LibraryInfoPopover } from './LibraryInfoPopover';
import type { LibraryOverview } from './detailsPanelTypes';

type ContextInfoButtonProps = {
  overview: LibraryOverview;
  folder?: LibraryFolder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
};

/** Ícone discreto de informação — abre popover com contexto da Biblioteca ou pasta. */
export function ContextInfoButton({
  overview,
  folder,
  open,
  onOpenChange,
  className,
}: ContextInfoButtonProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);

  return (
    <div className={cn('relative shrink-0', className)}>
      <Tooltip label="Informações">
        <button
          ref={anchorRef}
          type="button"
          className="workspace-action-btn explorer-icon-btn"
          aria-label="Informações"
          aria-expanded={open}
          aria-haspopup="dialog"
          data-testid="library-context-info-button"
          onClick={() => onOpenChange(!open)}
        >
          <Icon name="info" size={ICON_SIZE.sm} />
        </button>
      </Tooltip>

      <AnchoredPopover
        anchorRef={anchorRef}
        open={open}
        onClose={() => onOpenChange(false)}
        placement="bottom-end"
        aria-label="Informações"
        className="w-[min(20rem,calc(100vw-2rem))]"
      >
        <LibraryInfoPopover overview={overview} folder={folder} />
      </AnchoredPopover>
    </div>
  );
}
