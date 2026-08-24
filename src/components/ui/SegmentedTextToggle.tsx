import { cn } from '@/lib/utils';

type SegmentedTextToggleOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentedTextToggleProps<T extends string> = {
  value: T;
  options: SegmentedTextToggleOption<T>[];
  onChange: (value: T) => void;
  'aria-label': string;
  className?: string;
};

/**
 * Escolha entre poucas vistas — irmão de texto do `SegmentedIconToggle`.
 *
 * Sem cápsula e sem preenchimento: é controle horizontal, então o escolhido
 * marca com régua de acento embaixo. Nasceu de três telas que resolveram a
 * mesma coisa três vezes — período na Visão Geral, lente na Matriz e status em
 * Usuários — e cada cópia tinha uma altura e um tamanho de texto diferentes.
 */
export function SegmentedTextToggle<T extends string>({
  value,
  options,
  onChange,
  'aria-label': ariaLabel,
  className,
}: SegmentedTextToggleProps<T>) {
  return (
    <div
      className={cn('flex h-9 items-stretch gap-1', className)}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={isActive}
            className={cn(
              'relative rounded-[4px] px-2.5 text-caption font-medium transition-colors duration-150',
              'after:absolute after:inset-x-2.5 after:bottom-0 after:h-[2px] after:transition-colors after:duration-150',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-doqyn-accent-active/30',
              isActive
                ? 'text-doqyn-text after:bg-doqyn-accent-active'
                : 'text-doqyn-muted after:bg-transparent hover:text-doqyn-text',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
