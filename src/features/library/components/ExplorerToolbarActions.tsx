import { FilterMenu } from './FilterMenu';
import { OwnerFilterMenu } from './OwnerFilterMenu';
import { PeriodFilterMenu } from './PeriodFilterMenu';
import { SortMenu } from './SortMenu';
import { TypeFilterMenu } from './TypeFilterMenu';
import { ViewModeToggle } from './ViewModeToggle';
import { WorkspaceRefreshButton } from '@/components/layout/WorkspaceRefreshButton';
import type { LibraryRouteState } from '../types/library';
import type { LibraryCollectionFilterCapabilities } from '../utils/libraryCollectionFilterCapabilities';

type ExplorerToolbarActionsProps = {
  state: LibraryRouteState;
  onStateChange: (patch: Partial<LibraryRouteState>) => void;
  onRefresh: () => void;
  /** Exibe filtros e ordenação (pastas e coleções virtuais). */
  showFilters?: boolean;
  filterCapabilities?: LibraryCollectionFilterCapabilities;
  refreshLabel?: string;
};

/**
 * Grupo único de ações do explorer — filtro, sort, view, refresh.
 * Deve aparecer uma vez por página, no header.
 */
export function ExplorerToolbarActions({
  state,
  onStateChange,
  onRefresh,
  showFilters = false,
  filterCapabilities,
  refreshLabel = 'Atualizar biblioteca',
}: ExplorerToolbarActionsProps) {
  const caps = filterCapabilities ?? {
    status: true,
    type: true,
    period: true,
    owner: true,
    sort: true,
    view: true,
  };

  const showAnyDocumentFilter =
    caps.status || caps.type || caps.period || caps.owner || caps.sort;

  return (
    <>
      {showFilters && showAnyDocumentFilter && (
        <>
          {caps.status && (
            <FilterMenu
              status={state.status}
              onStatusChange={(status) => onStateChange({ status })}
            />
          )}
          {caps.type && (
            <TypeFilterMenu
              value={state.type}
              onChange={(type) => onStateChange({ type })}
            />
          )}
          {caps.period && (
            <PeriodFilterMenu
              value={state.period}
              onChange={(period) => onStateChange({ period })}
            />
          )}
          {caps.owner && (
            <OwnerFilterMenu
              value={state.owner}
              onChange={(owner) => onStateChange({ owner })}
            />
          )}
          {caps.sort && (
            <SortMenu
              sort={state.sort}
              direction={state.direction}
              onChange={(patch) => onStateChange(patch)}
            />
          )}
        </>
      )}
      {caps.view && (
        <ViewModeToggle
          value={state.view}
          onChange={(view) => onStateChange({ view })}
        />
      )}
      <WorkspaceRefreshButton onClick={onRefresh} label={refreshLabel} />
    </>
  );
}
