import type { LibraryRouteState } from '../types/library';

type SearchScopeHintProps = {
  state: LibraryRouteState;
  folderName: string;
  onStateChange: (patch: Partial<LibraryRouteState>) => void;
};

/** Indica escopo da busca dentro de uma pasta e permite expandir para toda a biblioteca. */
export function SearchScopeHint({ state, folderName, onStateChange }: SearchScopeHintProps) {
  if (!state.q.trim()) return null;

  if (state.scope === 'all') {
    return (
      <p className="text-[13px] text-doqyn-muted" data-testid="library-search-scope">
        Buscando em toda a biblioteca
      </p>
    );
  }

  return (
    <p className="text-[13px] text-doqyn-muted" data-testid="library-search-scope">
      Buscando em <span className="font-medium text-doqyn-text">{folderName}</span>
      {' · '}
      <button
        type="button"
        className="font-medium text-doqyn-accent hover:underline"
        onClick={() => onStateChange({ scope: 'all' })}
      >
        Buscar em toda a Biblioteca
      </button>
    </p>
  );
}
