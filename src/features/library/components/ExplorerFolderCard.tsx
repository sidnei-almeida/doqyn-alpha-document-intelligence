import { useContext } from 'react';
import type { MouseEvent } from 'react';
import { Icon } from '@/components/ui/Icon';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { getFolderAccentColor } from '../utils/folderColors';
import type { LibraryFolder } from '../types/library';
import { ExplorerActionsContext } from '../context/explorerActionsContext';
import { useSelectableItemRef } from '../hooks/useSelectableItemRef';

type ExplorerFolderCardProps = {
  folder: LibraryFolder;
  onOpen: (folder: LibraryFolder) => void;
  onContextMenu: (folder: LibraryFolder, x: number, y: number) => void;
  onShowInfo?: (folder: LibraryFolder) => void;
};

/**
 * Pasta na raiz da Biblioteca — card horizontal compacto com presença visual.
 */
export function ExplorerFolderCard({
  folder,
  onOpen,
  onContextMenu,
  onShowInfo,
}: ExplorerFolderCardProps) {
  const explorerActions = useContext(ExplorerActionsContext);
  const isSelected = explorerActions?.isFolderSelected(folder.id) ?? false;
  const selectableRef = useSelectableItemRef(folder.id, 'folder');
  const accent = getFolderAccentColor(folder.name);

  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onContextMenu(folder, event.clientX, event.clientY);
  };

  const countLabel = `${folder.documentCount} ${
    folder.documentCount === 1 ? 'arquivo' : 'arquivos'
  }`;

  return (
    <div
      ref={selectableRef}
      role="button"
      tabIndex={0}
      data-explorer-item="folder"
      data-explorer-item-id={folder.id}
      data-testid="explorer-folder-card"
      onClick={() => onOpen(folder)}
      onDoubleClick={(event) => {
        event.preventDefault();
        onOpen(folder);
      }}
      onContextMenu={handleContextMenu}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(folder);
        }
      }}
      className={cn(
        'group explorer-folder-card drive-folder-tile explorer-interactive explorer-focus-ring relative flex min-h-[48px] w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left',
        'bg-doqyn-surface shadow-sm',
        'hover:bg-doqyn-surface-hover hover:shadow-md active:scale-[0.995]',
        isSelected && 'explorer-item-selected explorer-selected',
      )}
      aria-selected={isSelected}
      aria-label={`Abrir pasta ${folder.name}`}
    >
      <span className="folder-icon-chip flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-doqyn-surface-2">
        <Icon
          name="folder"
          filled
          size={ICON_SIZE.md}
          color={accent ?? 'var(--folder-accent-default)'}
        />
      </span>

      <div className="min-w-0 flex-1 pr-12">
        <TruncatedText className="text-label font-medium text-doqyn-text">{folder.name}</TruncatedText>
        <p className="truncate text-caption text-doqyn-subtle">{countLabel}</p>
      </div>

      {onShowInfo && (
        <Tooltip label="Informações">
          <button
            type="button"
            className="explorer-icon-btn workspace-action-btn absolute right-9 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100"
            aria-label={`Informações de ${folder.name}`}
            data-no-marquee-select
            data-testid="explorer-folder-info-button"
            onClick={(event) => {
              event.stopPropagation();
              onShowInfo(folder);
            }}
          >
            <Icon name="info" size={ICON_SIZE.sm} />
          </button>
        </Tooltip>
      )}

      <button
        type="button"
        className="explorer-icon-btn workspace-action-btn absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100"
        aria-label={`Menu de ${folder.name}`}
        data-no-marquee-select
        onClick={(event) => {
          event.stopPropagation();
          const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
          onContextMenu(folder, rect.left, rect.bottom);
        }}
      >
        <Icon name="more_horiz" size={ICON_SIZE.sm} />
      </button>
    </div>
  );
}
