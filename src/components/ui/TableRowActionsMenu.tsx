import { useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import { AnchoredPopover } from '@/components/ui/popover/AnchoredPopover';
import { DropdownMenuItem } from '@/components/ui/DropdownMenuItem';
import { IconButton } from './IconButton';

export type TableRowAction = {
  label: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
  hidden?: boolean;
};

type TableRowActionsMenuProps = {
  actions: TableRowAction[];
  align?: 'left' | 'right';
};

export function TableRowActionsMenu({ actions, align = 'right' }: TableRowActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const visibleActions = actions.filter((action) => !action.hidden);

  if (visibleActions.length === 0) return null;

  return (
    <div
      className={cn('relative', align === 'right' && 'flex justify-end')}
      onClick={(event) => event.stopPropagation()}
    >
      <IconButton
        ref={anchorRef}
        label="Ações da linha"
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="more_horiz" size={ICON_SIZE.sm} />
      </IconButton>

      <AnchoredPopover
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        placement={align === 'right' ? 'bottom-end' : 'bottom-start'}
        role="menu"
        className="min-w-[11rem] rounded-md py-1 shadow-modal"
      >
        {visibleActions.map((action) => (
          <DropdownMenuItem
            key={action.label}
            itemRole="menuitem"
            tone={action.tone === 'danger' ? 'danger' : 'default'}
            onClick={() => {
              setOpen(false);
              action.onClick();
            }}
          >
            {action.label}
          </DropdownMenuItem>
        ))}
      </AnchoredPopover>
    </div>
  );
}
