import {
  forwardRef,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ChangeEvent,
} from 'react';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import { AnchoredPopover } from '@/components/ui/popover/AnchoredPopover';
import { DropdownMenuItem } from '@/components/ui/DropdownMenuItem';
import { fieldControlClass, fieldLabelClass, fieldWrapperClass } from './fieldStyles';
import { useTranslation } from 'react-i18next';

export interface SelectProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'value' | 'onChange'
> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  value?: string;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  /** `boxed` para formulários, `rule` para barras de filtro. */
  variant?: 'boxed' | 'rule';
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      className,
      label,
      error,
      id,
      options,
      value = '',
      disabled,
      onChange,
      variant = 'boxed',
      ...props
    },
    ref,
  ) => {
    const { t } = useTranslation('components');
    const [open, setOpen] = useState(false);
    const [anchorWidth, setAnchorWidth] = useState<number>();
    const anchorRef = useRef<HTMLButtonElement>(null);
    const selectedLabel = options.find((option) => option.value === value)?.label;
    const isRule = variant === 'rule';

    useLayoutEffect(() => {
      if (!open || !anchorRef.current) return;
      setAnchorWidth(anchorRef.current.getBoundingClientRect().width);
    }, [open]);

    const setRefs = (node: HTMLButtonElement | null) => {
      anchorRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    };

    const emitChange = (nextValue: string) => {
      onChange?.({
        target: { value: nextValue },
      } as ChangeEvent<HTMLSelectElement>);
    };

    return (
      <div className={isRule ? 'flex min-w-0 flex-col gap-1.5' : fieldWrapperClass}>
        {label && (
          <label
            htmlFor={id}
            className={isRule ? 'register-label text-doqyn-subtle' : fieldLabelClass}
          >
            {label}
          </label>
        )}
        <button
          ref={setRefs}
          id={id}
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setOpen((current) => !current)}
          className={cn(
            'flex w-full items-center justify-between gap-2 text-left',
            isRule
              ? 'field-rule text-label'
              : cn(
                  fieldControlClass,
                  error && 'border-doqyn-danger focus-visible:ring-doqyn-danger/30',
                ),
            disabled && 'cursor-not-allowed opacity-40',
            className,
          )}
          aria-expanded={open}
          aria-haspopup="listbox"
          {...props}
        >
          <span className="min-w-0 truncate">{selectedLabel ?? t('select.placeholder')}</span>
          <Icon
            name="expand_more"
            size={isRule ? ICON_SIZE.xs : ICON_SIZE.sm}
            className={cn(
              'shrink-0 text-doqyn-subtle transition-transform duration-[var(--transition-duration-fast)]',
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
          className="max-w-[min(24rem,calc(100vw-1rem))] py-1"
          panelStyle={anchorWidth ? { minWidth: anchorWidth } : undefined}
        >
          {options.map((option) => (
            <DropdownMenuItem
              key={option.value}
              selected={option.value === value}
              onClick={() => {
                emitChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </AnchoredPopover>
        {error && <p className="form-error">{error}</p>}
      </div>
    );
  },
);
Select.displayName = 'Select';
