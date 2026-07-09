import { Icon } from '@/components/ui/Icon';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';
import { ICON_SIZE } from '@/lib/iconDefaults';
import type { DocumentListItem } from '@/types/document-library';
import { useExplorerFileActions } from '../context/useExplorerFileActions';

type ExplorerFileQuickActionsProps = {
  document: DocumentListItem;
  onPreview: () => void;
  onDetails: () => void;
  onDownload: () => void;
  onMore: (x: number, y: number) => void;
  className?: string;
};

/** Ações rápidas no hover — não competem com o estado de seleção. */
export function ExplorerFileQuickActions({
  document: doc,
  onPreview,
  onDetails,
  onDownload,
  onMore,
  className,
}: ExplorerFileQuickActionsProps) {
  const { isStarred, toggleStar } = useExplorerFileActions();
  const canPreview = doc.permissions?.canPreview !== false && Boolean(doc.latestVersionId);
  const canDownload = Boolean(doc.permissions?.canDownload && doc.latestVersionId);
  const starred = doc.isFavorite === true || isStarred(doc.documentId);

  return (
    <div
      className={cn(
        'explorer-quick-actions absolute right-1.5 top-1.5 z-20 flex items-center gap-0.5 rounded-lg p-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100',
        className,
      )}
      data-testid="explorer-file-quick-actions"
      data-no-marquee-select
    >
      <Tooltip label={starred ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}>
        <button
          type="button"
          className={cn('explorer-icon-btn h-7 w-7', starred && 'text-doqyn-warning')}
          aria-label={starred ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          aria-pressed={starred}
          onClick={(event) => {
            event.stopPropagation();
            toggleStar(doc);
          }}
        >
          <Icon name="star" filled={starred} size={ICON_SIZE.sm} />
        </button>
      </Tooltip>
      {canPreview && (
        <Tooltip label="Visualizar">
          <button
            type="button"
            className="explorer-icon-btn h-7 w-7"
            aria-label="Visualizar"
            onClick={(event) => {
              event.stopPropagation();
              onPreview();
            }}
          >
            <Icon name="visibility" size={ICON_SIZE.sm} />
          </button>
        </Tooltip>
      )}
      <Tooltip label="Detalhes">
        <button
          type="button"
          className="explorer-icon-btn h-7 w-7"
          aria-label="Detalhes"
          onClick={(event) => {
            event.stopPropagation();
            onDetails();
          }}
        >
          <Icon name="info" size={ICON_SIZE.sm} />
        </button>
      </Tooltip>
      {canDownload && (
        <Tooltip label="Baixar">
          <button
            type="button"
            className="explorer-icon-btn h-7 w-7"
            aria-label="Baixar"
            onClick={(event) => {
              event.stopPropagation();
              onDownload();
            }}
          >
            <Icon name="download" size={ICON_SIZE.sm} />
          </button>
        </Tooltip>
      )}
      <Tooltip label="Mais opções">
        <button
          type="button"
          className="explorer-icon-btn h-7 w-7"
          aria-label="Mais opções"
          onClick={(event) => {
            event.stopPropagation();
            const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
            onMore(rect.left, rect.bottom);
          }}
        >
          <Icon name="more_horiz" size={ICON_SIZE.sm} />
        </button>
      </Tooltip>
    </div>
  );
}
