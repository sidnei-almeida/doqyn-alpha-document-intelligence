import type { ReactNode } from 'react';
import { ExplorerPageHeader } from './ExplorerPageHeader';
import type { LibraryRouteState } from '../types/library';

type ExplorerHomeHeaderProps = {
  title?: string;
  subtitle?: string;
  viewMode: LibraryRouteState['view'];
  onViewModeChange: (mode: LibraryRouteState['view']) => void;
  onRefresh?: () => void;
  infoButton?: ReactNode;
  toolbar?: ReactNode;
};

/**
 * @deprecated Use ExplorerPageHeader — mantido para compatibilidade de imports.
 */
export function ExplorerHomeHeader({
  title = 'Biblioteca',
  subtitle = 'Documentos e categorias deste ambiente',
  viewMode,
  onViewModeChange,
  onRefresh,
  infoButton,
}: ExplorerHomeHeaderProps) {
  return (
    <ExplorerPageHeader
      data-testid="explorer-home-header"
      title={title}
      subtitle={subtitle}
      state={{
        view: viewMode,
        status: '',
        sort: 'updatedAt',
        direction: 'desc',
        q: '',
        space: '',
        type: '',
        period: '',
        owner: '',
        scope: '',
      }}
      onStateChange={(patch) => {
        if (patch.view) onViewModeChange(patch.view);
      }}
      onClearFilters={() => undefined}
      onRefresh={onRefresh ?? (() => undefined)}
      showFilterChips
      showTitleChevron
      infoButton={infoButton ?? null}
    />
  );
}
