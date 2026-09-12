import { Icon } from '@/components/ui/Icon';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';
import { ICON_SIZE } from '@/lib/iconDefaults';
import type { DocumentListItem } from '@/types/document-library';
import { useExplorerFileActions } from '../context/useExplorerFileActions';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('library');

  const { isStarred, toggleStar } = useExplorerFileActions();
  const canPreview = doc.permissions?.canPreview !== false && Boolean(doc.latestVersionId);
  const canDownload = Boolean(doc.permissions?.canDownload && doc.latestVersionId);
  const starred = doc.isFavorite === true || isStarred(doc.documentId);

  return (
    <div
      className={cn(
        'explorer-quick-actions absolute right-1.5 top-1.5 z-20 flex items-center gap-0.5 rounded-[4px] p-0.5 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100',
        className,
      )}
      data-testid="explorer-file-quick-actions"
      data-no-marquee-select
    >
      <Tooltip label={t(starred ? 'favorites.remove' : 'favorites.add')}>
        <button
          type="button"
          className={cn('explorer-icon-btn h-7 w-7', starred && 'text-doqyn-warning')}
          aria-label={t(starred ? 'favorites.remove' : 'favorites.add')}
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
        <Tooltip label={t('explorerFileQuickActions.visualizar')}>
          <button
            type="button"
            className="explorer-icon-btn h-7 w-7"
            aria-label={t('explorerFileQuickActions.visualizar2')}
            onClick={(event) => {
              event.stopPropagation();
              onPreview();
            }}
          >
            <Icon name="visibility" size={ICON_SIZE.sm} />
          </button>
        </Tooltip>
      )}
      <Tooltip label={t('explorerFileQuickActions.detalhes')}>
        <button
          type="button"
          className="explorer-icon-btn h-7 w-7"
          aria-label={t('explorerFileQuickActions.detalhes2')}
          onClick={(event) => {
            event.stopPropagation();
            onDetails();
          }}
        >
          <Icon name="info" size={ICON_SIZE.sm} />
        </button>
      </Tooltip>
      {canDownload && (
        <Tooltip label={t('explorerFileQuickActions.baixar')}>
          <button
            type="button"
            className="explorer-icon-btn h-7 w-7"
            aria-label={t('explorerFileQuickActions.baixar2')}
            onClick={(event) => {
              event.stopPropagation();
              onDownload();
            }}
          >
            <Icon name="download" size={ICON_SIZE.sm} />
          </button>
        </Tooltip>
      )}
      <Tooltip label={t('explorerFileQuickActions.maisOpcoes')}>
        <button
          type="button"
          className="explorer-icon-btn h-7 w-7"
          aria-label={t('explorerFileQuickActions.maisOpcoes2')}
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
