import type { LibraryRouteState } from '../types/library';
import { useTranslation } from 'react-i18next';

type SearchScopeHintProps = {
  state: LibraryRouteState;
  folderName: string;
  onStateChange: (patch: Partial<LibraryRouteState>) => void;
};

/** Indica escopo da busca dentro de uma pasta e permite expandir para toda a biblioteca. */
export function SearchScopeHint({ state, folderName, onStateChange }: SearchScopeHintProps) {
  const { t } = useTranslation('library');

  if (!state.q.trim()) return null;

  if (state.scope === 'all') {
    return (
      <p className="text-[13px] text-doqyn-muted" data-testid="library-search-scope">
        {t('searchScopeHint.buscandoEmTodaA')}
      </p>
    );
  }

  return (
    <p className="text-[13px] text-doqyn-muted" data-testid="library-search-scope">
      {t('searchScopeHint.buscandoEm')}{' '}
      <span className="font-medium text-doqyn-text">{folderName}</span>
      {' · '}
      <button
        type="button"
        className="font-medium text-doqyn-accent-active hover:underline"
        onClick={() => onStateChange({ scope: 'all' })}
      >
        {t('searchScopeHint.buscarEmTodaA')}
      </button>
    </p>
  );
}
