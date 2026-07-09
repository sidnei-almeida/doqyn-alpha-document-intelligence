import { FilterMenu } from './FilterMenu';
import { OwnerFilterMenu } from './OwnerFilterMenu';
import { PeriodFilterMenu } from './PeriodFilterMenu';
import { SortMenu } from './SortMenu';
import { TypeFilterMenu } from './TypeFilterMenu';
import { ViewModeToggle } from './ViewModeToggle';
import { WorkspaceRefreshButton } from '@/components/layout/WorkspaceRefreshButton';
import type { LibraryRouteState } from '../types/library';

type ExplorerToolbarActionsProps = {
  state: LibraryRouteState;
  onStateChange: (patch: Partial<LibraryRouteState>) => void;
  onRefresh: () => void;
  /** Exibe filtros e ordenação (pastas e coleções virtuais). */
  showFilters?: boolean;
  /** Oculta filtro de categoria quando já está dentro da pasta. */
  hideCategoryFilter?: boolean;
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
  refreshLabel = 'Atualizar biblioteca',
}: ExplorerToolbarActionsProps) {
  return (
    <>
      {showFilters && (
        <>
          <FilterMenu
            status={state.status}
            onStatusChange={(status) => onStateChange({ status })}
          />
          <TypeFilterMenu
            value={state.type}
            onChange={(type) => onStateChange({ type })}
          />
          <PeriodFilterMenu
            value={state.period}
            onChange={(period) => onStateChange({ period })}
          />
          <OwnerFilterMenu
            value={state.owner}
            onChange={(owner) => onStateChange({ owner })}
          />
          <SortMenu
            sort={state.sort}
            direction={state.direction}
            onChange={(patch) => onStateChange(patch)}
          />
        </>
      )}
      <ViewModeToggle
        value={state.view}
        onChange={(view) => onStateChange({ view })}
      />
      <WorkspaceRefreshButton onClick={onRefresh} label={refreshLabel} />
    </>
  );
}
