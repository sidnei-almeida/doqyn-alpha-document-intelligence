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
        // Sem cápsula: o grupo era uma pílula preenchida com um botão preenchido
        // dentro — dois níveis de superfície para escolher entre duas vistas.
        // Agora são dois glifos soltos, e o ativo é marcado por um fio embaixo,
        // como a régua que o resto do sistema usa.
        'flex items-center gap-1',
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
                'explorer-interactive relative flex h-8 w-8 items-center justify-center rounded-[3px]',
                'after:absolute after:inset-x-1.5 after:bottom-0 after:h-[2px] after:bg-transparent',
                isActive
                  ? 'text-doqyn-text after:bg-doqyn-accent-active'
                  : 'text-doqyn-subtle hover:text-doqyn-text',
              )}
            >
              <Icon
                name={option.icon}
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
