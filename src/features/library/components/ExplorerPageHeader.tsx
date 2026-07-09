import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { WorkspacePageHeader } from '@/components/layout/WorkspacePageHeader';
import { ICON_SIZE } from '@/lib/iconDefaults';
import type { LibraryRouteState } from '../types/library';
import { hasActiveLibraryFilters } from '../utils/libraryFilterUtils';
import { ActiveFilterChips } from './ActiveFilterChips';
import { ExplorerFilterChips } from './ExplorerFilterChips';
import { ExplorerToolbarActions } from './ExplorerToolbarActions';

type ExplorerPageHeaderProps = {
  breadcrumb?: ReactNode;
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  state: LibraryRouteState;
  onStateChange: (patch: Partial<LibraryRouteState>) => void;
  onClearFilters: () => void;
  onRefresh: () => void;
  infoButton: ReactNode;
  /** Raiz sem busca/filtro ativo — chips discretos abaixo do título. */
  showFilterChips?: boolean;
  /** Pastas e coleções virtuais — menus de filtro/ordenação no header. */
  showFilterMenus?: boolean;
  /** Chevron decorativo ao lado do título (home). */
  showTitleChevron?: boolean;
  folderName?: string;
  'data-testid'?: string;
};

/**
 * Header único do File Explorer — um título, um grupo de ações, sem duplicação.
 */
export function ExplorerPageHeader({
  breadcrumb,
  title,
  subtitle,
  meta,
  state,
  onStateChange,
  onClearFilters,
  onRefresh,
  infoButton,
  showFilterChips = false,
  showFilterMenus = false,
  showTitleChevron = false,
  folderName,
  'data-testid': testId = 'explorer-page-header',
}: ExplorerPageHeaderProps) {
  const showActiveChips =
    hasActiveLibraryFilters(state) && (showFilterMenus || Boolean(state.q.trim()));

  return (
    <WorkspacePageHeader
      data-testid={testId}
      breadcrumb={breadcrumb}
      title={title}
      subtitle={subtitle}
      meta={meta}
      titleAccessory={
        showTitleChevron ? (
          <Icon
            name="keyboard_arrow_down"
            size={ICON_SIZE.sm}
            className="mt-0.5 shrink-0 text-doqyn-subtle"
          />
        ) : undefined
      }
      actions={
        <>
          <ExplorerToolbarActions
            state={state}
            onStateChange={onStateChange}
            onRefresh={onRefresh}
            showFilters={showFilterMenus}
          />
          {infoButton}
        </>
      }
      toolbar={
        showFilterChips ? (
          <ExplorerFilterChips state={state} onStateChange={onStateChange} />
        ) : showActiveChips ? (
          <ActiveFilterChips
            state={state}
            onStateChange={onStateChange}
            onClearAll={onClearFilters}
            folderName={folderName}
          />
        ) : undefined
      }
    />
  );
}
