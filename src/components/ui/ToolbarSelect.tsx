import { useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { AnchoredPopover } from '@/components/ui/popover/AnchoredPopover';
import { DropdownMenuItem } from '@/components/ui/DropdownMenuItem';
import { cn } from '@/lib/utils';
import { ICON_SIZE } from '@/lib/iconDefaults';

type ToolbarSelectOption = {
  value: string;
  label: string;
};

type ToolbarSelectProps = {
  icon: string;
  label: string;
  value: string;
  options: ToolbarSelectOption[];
  onChange: (value: string) => void;
  defaultValue?: string;
  className?: string;
};

/** Dropdown temático para toolbar — pill discreto com ícone. */
export function ToolbarSelect({
  icon,
  label,
  value,
  options,
  onChange,
  defaultValue = '',
  className,
}: ToolbarSelectProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const isActive = value !== defaultValue;
  const selectedLabel = options.find((option) => option.value === value)?.label ?? options[0]?.label;

  return (
    <div className={cn('relative shrink-0', className)}>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'explorer-interactive flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px]',
          isActive
            ? 'bg-doqyn-selected text-doqyn-text'
            : 'toolbar-pill-idle text-doqyn-muted hover:bg-doqyn-surface-hover hover:text-doqyn-text',
          open && 'bg-doqyn-surface-hover text-doqyn-text',
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={label}
      >
        <Icon name={icon} size={ICON_SIZE.sm} className="shrink-0" />
        <span className="max-w-[9rem] truncate">{selectedLabel}</span>
        <Icon
          name="keyboard_arrow_down"
          size={ICON_SIZE.sm}
          className={cn(
            'shrink-0 opacity-70 transition-transform duration-[var(--transition-duration-fast)]',
            open && 'rotate-180',
          )}
        />
      </button>

      <AnchoredPopover
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        placement="bottom-start"
        role="listbox"
        aria-label={label}
        className="min-w-[11rem] max-w-[min(18rem,calc(100vw-1rem))] py-1"
        panelStyle={
          anchorRef.current
            ? { minWidth: anchorRef.current.getBoundingClientRect().width }
            : undefined
        }
      >
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            selected={option.value === value}
            onClick={() => {
              onChange(option.value);
              setOpen(false);
            }}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </AnchoredPopover>
    </div>
  );
}
