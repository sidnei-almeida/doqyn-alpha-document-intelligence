import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/utils';

type HoverCheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  className?: string;
};

/**
 * Checkbox reservado no layout (w-4) — visível no hover da linha ou quando marcado.
 * Padrão Google Drive: não desloca os demais elementos.
 */
export function HoverCheckbox({ checked, onChange, label, className }: HoverCheckboxProps) {
  return (
    <span className={cn('relative flex h-4 w-4 shrink-0 items-center justify-center', className)}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => {
          event.stopPropagation();
          onChange(event.target.checked);
        }}
        onClick={(event) => event.stopPropagation()}
        aria-label={label}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          'flex h-4 w-4 items-center justify-center rounded border transition-all duration-[var(--transition-duration-fast)] ease-[var(--ease-standard)]',
          'border-doqyn-border bg-doqyn-bg',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-doqyn-border-strong peer-focus-visible:ring-offset-1',
          checked
            ? 'border-doqyn-accent-active bg-doqyn-accent-active opacity-100'
            : 'opacity-0 group-hover:opacity-100 peer-focus-visible:opacity-100',
          checked && 'opacity-100',
        )}
      >
        <Icon
          name="check"
          filled
          size={12}
          weight={700}
          className={cn('text-doqyn-on-accent', checked ? 'opacity-100' : 'opacity-0')}
        />
      </span>
    </span>
  );
}
