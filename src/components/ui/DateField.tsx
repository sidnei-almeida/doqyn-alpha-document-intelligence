import { useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { AnchoredPopover } from '@/components/ui/popover/AnchoredPopover';
import { cn, formatDate } from '@/lib/utils';
import { parseIsoDate } from '@/lib/dateValue';
import { CalendarPanel } from './CalendarPanel';
import { useTranslation } from 'react-i18next';
import { fieldControlClass, fieldLabelClass, fieldWrapperClass } from './fieldStyles';

export type DateFieldProps = {
  id?: string;
  label?: string;
  /** Data em `yyyy-mm-dd`. */
  value?: string;
  onChange: (isoDate: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
  /** `boxed` para formulários, `rule` para barras de filtro. */
  variant?: 'boxed' | 'rule';
  'aria-label'?: string;
};

/**
 * Campo de data — botão no tema que abre o calendário do produto.
 *
 * O `<input type="date">` entrega o calendário do navegador: fonte, canto e
 * cor de seleção do sistema operacional, diferente em cada máquina e sem
 * relação nenhuma com o resto da tela.
 */
export function DateField({
  id,
  label,
  value = '',
  onChange,
  placeholder: placeholderProp,
  min,
  max,
  disabled,
  error,
  className,
  variant = 'boxed',
  'aria-label': ariaLabel,
}: DateFieldProps) {
  const { t } = useTranslation('components');
  const placeholder = placeholderProp ?? t('dateField.placeholder');
  const [open, setOpen] = useState(false);
  const [anchorWidth, setAnchorWidth] = useState<number>();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const parsed = parseIsoDate(value);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    setAnchorWidth(anchorRef.current.getBoundingClientRect().width);
  }, [open]);

  const isRule = variant === 'rule';

  const trigger = (
    <button
      ref={anchorRef}
      id={id}
      type="button"
      disabled={disabled}
      onClick={() => !disabled && setOpen((current) => !current)}
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-label={ariaLabel ?? label}
      className={cn(
        'flex w-full items-center gap-2 text-left',
        isRule
          ? 'field-rule justify-between'
          : cn(fieldControlClass, 'justify-between', error && 'border-doqyn-danger'),
        disabled && 'cursor-not-allowed opacity-40',
        className,
      )}
    >
      <span
        className={cn(
          'min-w-0 truncate font-mono tabular-nums',
          isRule ? 'text-caption' : 'text-label',
          parsed ? 'text-doqyn-text' : 'text-doqyn-subtle',
        )}
      >
        {/* A string, e não o `Date` local: `yyyy-mm-dd` é data de calendário e não passa por fuso. */}
        {parsed ? formatDate(value.slice(0, 10)) : placeholder}
      </span>
      <Icon name="calendar_today" size={ICON_SIZE.xs} className="shrink-0 text-doqyn-subtle" />
    </button>
  );

  const popover = (
    <AnchoredPopover
      anchorRef={anchorRef}
      open={open}
      onClose={() => setOpen(false)}
      placement="bottom-start"
      role="dialog"
      aria-label={label ?? ariaLabel ?? t('dateField.calendar')}
      panelStyle={anchorWidth ? { minWidth: anchorWidth } : undefined}
    >
      <CalendarPanel
        value={value || undefined}
        min={min}
        max={max}
        onSelect={(isoDate) => {
          onChange(isoDate);
          setOpen(false);
        }}
        onClear={() => {
          onChange('');
          setOpen(false);
        }}
      />
    </AnchoredPopover>
  );

  if (isRule) {
    return (
      <div className="flex min-w-0 flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="register-label text-doqyn-subtle">
            {label}
          </label>
        )}
        {trigger}
        {popover}
      </div>
    );
  }

  return (
    <div className={fieldWrapperClass}>
      {label && (
        <label htmlFor={id} className={fieldLabelClass}>
          {label}
        </label>
      )}
      {trigger}
      {popover}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
