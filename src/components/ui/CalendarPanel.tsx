import { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import { parseIsoDate, toIsoDate } from '@/lib/dateValue';
import { useTranslation } from 'react-i18next';

/** 4 de janeiro de 1970 caiu num domingo: dali, sete dias seguidos dão a semana na ordem da grade. */
function weekdayNames(locale: string): string[] {
  const format = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  return Array.from({ length: 7 }, (_, index) =>
    format.format(new Date(Date.UTC(1970, 0, 4 + index))).replace(/\.$/, ''),
  );
}

type CalendarPanelProps = {
  /** Data escolhida em `yyyy-mm-dd`. */
  value?: string;
  onSelect: (isoDate: string) => void;
  onClear?: () => void;
  min?: string;
  max?: string;
};

/**
 * Calendário do DOQYN — o do navegador é do sistema operacional, não do
 * produto: cada máquina desenhava um, com outra fonte, outro canto e outro
 * verde de seleção. Este segue a mesma gramática do resto: rótulos em
 * monoespaçado de registro, canto reto de 4px, o dia de hoje marcado por régua
 * e o dia escolhido por preenchimento de acento — cheio só onde houve decisão.
 */
export function CalendarPanel({ value, onSelect, onClear, min, max }: CalendarPanelProps) {
  const { t, i18n } = useTranslation('components');
  const locale = i18n.language;
  const weekdays = useMemo(() => weekdayNames(locale), [locale]);
  const monthFormat = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'long' }), [locale]);

  const selected = parseIsoDate(value);
  const today = new Date();
  const [cursor, setCursor] = useState(() => {
    const base = selected ?? today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const minDate = parseIsoDate(min);
  const maxDate = parseIsoDate(max);
  const todayIso = toIsoDate(today);

  const days = useMemo(() => {
    const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(firstOfMonth);
    start.setDate(1 - firstOfMonth.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      return {
        date,
        iso: toIsoDate(date),
        inMonth: date.getMonth() === cursor.getMonth(),
      };
    });
  }, [cursor]);

  const shiftMonth = (delta: number) =>
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));

  const isDisabled = (date: Date) =>
    (minDate ? date < minDate : false) || (maxDate ? date > maxDate : false);

  return (
    <div className="w-[17.5rem] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <IconButton label={t('calendarPanel.mesAnterior')} onClick={() => shiftMonth(-1)}>
          <Icon name="chevron_left" size={ICON_SIZE.sm} />
        </IconButton>
        <span className="type-label font-medium capitalize text-doqyn-text">
          {monthFormat.format(cursor)} {cursor.getFullYear()}
        </span>
        <IconButton label={t('calendarPanel.proximoMes')} onClick={() => shiftMonth(1)}>
          <Icon name="chevron_right" size={ICON_SIZE.sm} />
        </IconButton>
      </div>

      <div className="grid grid-cols-7 border-b border-doqyn-border-subtle pb-1.5">
        {weekdays.map((weekday, index) => (
          <span key={index} className="register-label text-center text-doqyn-subtle">
            {weekday}
          </span>
        ))}
      </div>

      <div className="mt-1.5 grid grid-cols-7 gap-0.5">
        {days.map(({ date, iso, inMonth }) => {
          const isSelected = value === iso;
          const isToday = todayIso === iso;
          const disabled = isDisabled(date);

          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(iso)}
              aria-pressed={isSelected}
              aria-current={isToday ? 'date' : undefined}
              className={cn(
                'relative flex h-8 items-center justify-center rounded-[4px] font-mono text-caption tabular-nums transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-doqyn-accent-active/40',
                'after:absolute after:inset-x-2 after:bottom-1 after:h-[2px] after:bg-transparent',
                inMonth ? 'text-doqyn-text' : 'text-doqyn-subtle/60',
                !disabled && !isSelected && 'hover:bg-doqyn-surface-hover',
                isToday && !isSelected && 'after:bg-doqyn-accent-active',
                isSelected && 'bg-doqyn-accent-active font-medium text-doqyn-bg',
                disabled && 'cursor-not-allowed opacity-30',
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-doqyn-border-subtle pt-2">
        <button
          type="button"
          onClick={() => {
            setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
            onSelect(todayIso);
          }}
          className="rounded-[4px] px-1.5 py-1 text-caption text-doqyn-muted transition-colors hover:text-doqyn-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-doqyn-accent-active/30"
        >
          {t('calendarPanel.hoje')}
        </button>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            disabled={!value}
            className="rounded-[4px] px-1.5 py-1 text-caption text-doqyn-muted transition-colors hover:text-doqyn-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-doqyn-accent-active/30 disabled:opacity-40 disabled:hover:text-doqyn-muted"
          >
            {t('calendarPanel.limpar')}
          </button>
        )}
      </div>
    </div>
  );
}
