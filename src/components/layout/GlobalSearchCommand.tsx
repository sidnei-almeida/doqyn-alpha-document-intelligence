import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/utils';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('components');

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const isLibrary = location.pathname.startsWith('/biblioteca');
  const [value, setValue] = useState(() => (isLibrary ? (searchParams.get('q') ?? '') : ''));
  const debouncedValue = useDebouncedValue(value, 400);
  /**
   * Termo que a URL acabou de impor ao campo, enquanto o campo ainda não o
   * refletiu. Sem esta marca, remover o chip "Busca: X" não limpava nada: os
   * dois efeitos rodam no mesmo commit, e o que empurra o campo para a URL
   * ainda enxergava o `value` antigo — devolvendo o termo que o chip tinha
   * acabado de apagar.
   */
  const urlImposedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLibrary) return;
    const urlQ = searchParams.get('q') ?? '';
    if (urlQ === value.trim()) {
      urlImposedRef.current = null;
      return;
    }
    urlImposedRef.current = urlQ;
    setValue(urlQ);
    // `value` fora das dependências de propósito: este efeito reage à URL, e
    // incluí-lo faria o campo se sobrescrever a cada tecla digitada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (urlImposedRef.current !== null) {
      // O campo está obedecendo à URL (chip removido, filtros limpos, deep
      // link). Só volta a empurrar depois que ele alcançar o termo imposto.
      if (urlImposedRef.current === value.trim()) urlImposedRef.current = null;
      return;
    }
    if (value.trim() !== debouncedValue.trim()) return;
    const urlQ = searchParams.get('q') ?? '';
    if (debouncedValue.trim() === urlQ.trim()) return;
    applyQueryToUrl(debouncedValue);
  }, [debouncedValue, value, isLibrary, searchParams, applyQueryToUrl]);

  const clearSearch = () => {
    urlImposedRef.current = null;
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
        placeholder={t('globalSearchCommand.buscarDocumentos')}
        aria-label={t('globalSearchCommand.buscarDocumentos2')}
        className={cn(
          // Sem régua própria. Empilhada com o fio do header e com as réguas
          // dos filtros logo abaixo, ela virava a terceira linha horizontal em
          // poucos pixels — pauta de caderno, não hierarquia. Em repouso a
          // busca é só o glifo e o texto dentro da barra; a superfície aparece
          // quando a pessoa vai usar, que é quando o campo precisa ter limite.
          'search-command h-10 w-full rounded-[4px] border-0 bg-transparent pl-9 pr-[4.75rem] text-body text-doqyn-text',
          'transition-[background-color,box-shadow] duration-[var(--transition-duration)] ease-[var(--ease-standard)]',
          'placeholder:text-doqyn-subtle hover:bg-doqyn-hover/50',
          'focus:bg-doqyn-panel focus:outline-none',
          'focus:shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent-active)_45%,transparent)]',
        )}
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
            className="explorer-icon-btn pointer-events-auto rounded-full p-1 text-doqyn-muted hover:bg-doqyn-surface-hover hover:text-doqyn-text"
            aria-label={t('globalSearchCommand.limparBusca')}
            onClick={clearSearch}
          >
            <Icon name="close" size={ICON_SIZE.xs} />
          </button>
        )}
        <kbd className="hidden items-center gap-0.5 rounded-md bg-doqyn-surface px-1.5 py-0.5 font-mono text-micro text-doqyn-subtle sm:inline-flex">
          {isMacPlatform() ? <Icon name="keyboard_command_key" size={12} /> : 'Ctrl'}
          <span>K</span>
        </kbd>
      </div>
    </div>
  );
}
