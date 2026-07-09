import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { ICON_SIZE } from '@/lib/iconDefaults';

type GlobalSearchCommandProps = {
  isFetching?: boolean;
};

/** Detecta macOS para exibir ⌘ vs Ctrl no hint do atalho (guard para SSR/testes). */
function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent || '');
}

/**
 * Busca global da TopBar — debounce, URL ?q=, limpar e ESC.
 */
export function GlobalSearchCommand({ isFetching = false }: GlobalSearchCommandProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const isLibrary = location.pathname.startsWith('/biblioteca');
  const [value, setValue] = useState(() => (isLibrary ? searchParams.get('q') ?? '' : ''));
  const debouncedValue = useDebouncedValue(value, 400);

  useEffect(() => {
    if (isLibrary) {
      setValue(searchParams.get('q') ?? '');
    }
  }, [isLibrary, searchParams]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const applyQueryToUrl = useCallback(
    (query: string, replace = true) => {
      const trimmed = query.trim();
      if (isLibrary) {
        setSearchParams(
          (params) => {
            const next = new URLSearchParams(params);
            if (trimmed) next.set('q', trimmed);
            else next.delete('q');
            return next;
          },
          { replace },
        );
        return;
      }
      const params = new URLSearchParams();
      if (trimmed) params.set('q', trimmed);
      navigate(`/biblioteca${params.toString() ? `?${params}` : ''}`);
    },
    [isLibrary, navigate, setSearchParams],
  );

  useEffect(() => {
    if (!isLibrary) return;
    if (value.trim() !== debouncedValue.trim()) return;
    const urlQ = searchParams.get('q') ?? '';
    if (debouncedValue.trim() === urlQ.trim()) return;
    applyQueryToUrl(debouncedValue);
  }, [debouncedValue, value, isLibrary, searchParams, applyQueryToUrl]);

  const clearSearch = () => {
    setValue('');
    applyQueryToUrl('');
    inputRef.current?.focus();
  };

  return (
    <div className="relative w-full" data-testid="global-search">
      <Icon
        name="search"
        size={ICON_SIZE.sm}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-doqyn-subtle"
      />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') applyQueryToUrl(value, false);
          if (event.key === 'Escape') {
            if (value) clearSearch();
            else inputRef.current?.blur();
          }
        }}
        placeholder="Buscar documentos por nome, categoria ou proprietário..."
        aria-label="Buscar documentos"
        className="search-command explorer-focus-ring h-11 w-full rounded-full border border-transparent bg-doqyn-surface pl-11 pr-[4.75rem] text-[14px] text-doqyn-text placeholder:text-doqyn-subtle transition-[background-color,box-shadow] duration-[var(--transition-duration)] ease-[var(--ease-standard)] hover:bg-doqyn-surface-hover focus:bg-doqyn-surface focus:outline-none focus:ring-1 focus:ring-doqyn-accent-active/15"
      />
      <div className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
        {isFetching && isLibrary && (
          <Icon
            name="progress_activity"
            className="animate-spin text-doqyn-subtle"
            size={ICON_SIZE.xs}
          />
        )}
        {value && (
          <button
            type="button"
            className="pointer-events-auto explorer-icon-btn rounded-full p-1 text-doqyn-muted hover:bg-doqyn-surface-hover hover:text-doqyn-text"
            aria-label="Limpar busca"
            onClick={clearSearch}
          >
            <Icon name="close" size={ICON_SIZE.xs} />
          </button>
        )}
        <kbd className="hidden items-center gap-0.5 rounded-md bg-doqyn-surface px-1.5 py-0.5 font-mono text-[10px] text-doqyn-subtle sm:inline-flex">
          {isMacPlatform() ? <Icon name="keyboard_command_key" size={12} /> : 'Ctrl'}
          <span>K</span>
        </kbd>
      </div>
    </div>
  );
}
