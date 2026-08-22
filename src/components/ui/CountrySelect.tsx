import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import { AnchoredPopover } from '@/components/ui/popover/AnchoredPopover';
import { DropdownMenuItem } from '@/components/ui/DropdownMenuItem';
import { listCountries, type CountryCode } from '@/lib/identifiers';
import { fieldControlClass, fieldLabelClass, fieldWrapperClass } from './fieldStyles';

export interface CountrySelectProps {
  label?: string;
  id?: string;
  error?: string;
  value: CountryCode;
  onChange: (country: CountryCode) => void;
  disabled?: boolean;
  className?: string;
}

/** Ignora acento e caixa: "Espanha" tem de aparecer para quem digita "espanha". */
function foldForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Seleção de país do cadastro. Diferente do `Select` genérico porque a lista tem 245 itens —
 * sem busca, escolher qualquer país que não seja o Brasil viraria rolagem cega.
 */
export function CountrySelect({
  label,
  id,
  error,
  value,
  onChange,
  disabled,
  className,
}: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [anchorWidth, setAnchorWidth] = useState<number>();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const countries = useMemo(() => listCountries(), []);
  const selected = countries.find((country) => country.code === value);

  const filtered = useMemo(() => {
    const term = foldForSearch(query.trim());
    if (!term) return countries;
    return countries.filter(
      (country) =>
        foldForSearch(country.name).includes(term) ||
        country.code.toLowerCase().includes(term) ||
        country.callingCode.includes(term),
    );
  }, [countries, query]);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    setAnchorWidth(anchorRef.current.getBoundingClientRect().width);
    searchRef.current?.focus();
  }, [open]);

  return (
    <div className={fieldWrapperClass}>
      {label && (
        <label htmlFor={id} className={fieldLabelClass}>
          {label}
        </label>
      )}
      <button
        ref={anchorRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((current) => !current)}
        className={cn(
          fieldControlClass,
          'flex items-center justify-between gap-2 text-left',
          error && 'border-doqyn-danger focus-visible:ring-doqyn-danger/30',
          className,
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="min-w-0 truncate">
          {selected ? `${selected.name} (+${selected.callingCode})` : 'Selecionar país'}
        </span>
        <Icon
          name="expand_more"
          size={ICON_SIZE.sm}
          className={cn(
            'shrink-0 text-doqyn-muted transition-transform duration-[var(--transition-duration-fast)]',
            open && 'rotate-180',
          )}
        />
      </button>

      <AnchoredPopover
        anchorRef={anchorRef}
        open={open}
        onClose={() => {
          setOpen(false);
          setQuery('');
        }}
        placement="bottom-start"
        role="listbox"
        aria-label={label ?? 'País'}
        className="max-w-[min(24rem,calc(100vw-1rem))] py-1"
        panelStyle={anchorWidth ? { minWidth: anchorWidth } : undefined}
      >
        <div className="px-2 pb-1 pt-1">
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar país"
            className="type-body h-8 w-full rounded-md border border-doqyn-border-subtle bg-doqyn-surface px-2.5 text-doqyn-text placeholder:text-doqyn-disabled focus-visible:border-doqyn-accent-active focus-visible:outline-none"
          />
        </div>
        <div className="max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="type-body px-3 py-2 text-doqyn-muted">Nenhum país encontrado.</p>
          ) : (
            filtered.map((country) => (
              <DropdownMenuItem
                key={country.code}
                selected={country.code === value}
                onClick={() => {
                  onChange(country.code);
                  setOpen(false);
                  setQuery('');
                }}
              >
                {country.name} (+{country.callingCode})
              </DropdownMenuItem>
            ))
          )}
        </div>
      </AnchoredPopover>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
