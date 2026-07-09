import { Icon } from '@/components/ui/Icon';
import { Tooltip } from '@/components/ui/Tooltip';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';

type SegmentedIconToggleOption<T extends string> = {
  value: T;
  label: string;
  icon: string;
};

type SegmentedIconToggleProps<T extends string> = {
  value: T;
  options: SegmentedIconToggleOption<T>[];
  onChange: (value: T) => void;
  'aria-label': string;
  className?: string;
};

/** Toggle segmentado por ícone — pill com estado ativo suave. */
export function SegmentedIconToggle<T extends string>({
  value,
  options,
  onChange,
  'aria-label': ariaLabel,
  className,
}: SegmentedIconToggleProps<T>) {
  return (
    <div
      className={cn(
        'flex items-center gap-0.5 rounded-full bg-doqyn-card/80 p-0.5',
        className,
      )}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <Tooltip key={option.value} label={option.label}>
            <button
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={isActive}
              aria-label={option.label}
              className={cn(
                'explorer-interactive flex h-8 w-9 items-center justify-center rounded-full active:scale-95',
                isActive
                  ? 'bg-doqyn-selected text-doqyn-text shadow-sm'
                  : 'text-doqyn-muted hover:bg-doqyn-surface-hover hover:text-doqyn-text',
              )}
            >
              <Icon
                name={option.icon}
                filled={isActive}
                size={ICON_SIZE.sm}
                className={isActive ? 'text-doqyn-text' : undefined}
              />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
