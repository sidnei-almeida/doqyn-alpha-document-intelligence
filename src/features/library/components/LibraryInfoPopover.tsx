import { Icon } from '@/components/ui/Icon';
import { Link } from 'react-router-dom';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { getFolderAccentColor } from '../utils/folderColors';
import type { LibraryFolder } from '../types/library';
import type { LibraryOverview } from './detailsPanelTypes';

type LibraryInfoPopoverProps = {
  overview: LibraryOverview;
  folder?: LibraryFolder | null;
};

/** Conteúdo do popover de informações da Biblioteca ou pasta atual. */
export function LibraryInfoPopover({ overview, folder }: LibraryInfoPopoverProps) {
  const accentColor = folder ? getFolderAccentColor(folder.name) : undefined;
  const title = folder?.name ?? overview.title;
  const description = folder?.description ?? overview.description;
  const fileCount = folder?.documentCount ?? overview.fileCount;
  const folderCount = overview.folderCount;

  return (
    <div className="p-4" data-testid="library-info-popover">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-doqyn-card">
          {folder ? (
            <Icon name="folder" filled color={accentColor} size={ICON_SIZE.md} />
          ) : (
            <Icon name="folder" filled size={ICON_SIZE.md} className="text-doqyn-muted" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-doqyn-text">{title}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-doqyn-muted">{description}</p>
        </div>
      </div>

      <dl className="mt-4 space-y-2 border-t border-doqyn-border-subtle pt-3 text-[12px]">
        <div className="flex justify-between gap-4">
          <dt className="text-doqyn-subtle">Tipo</dt>
          <dd className="text-right text-doqyn-text">
            {folder ? 'Categoria inteligente' : 'Biblioteca'}
          </dd>
        </div>
        {!folder && folderCount > 0 && (
          <div className="flex justify-between gap-4">
            <dt className="text-doqyn-subtle">Pastas</dt>
            <dd className="text-right text-doqyn-text">{folderCount}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt className="text-doqyn-subtle">Arquivos</dt>
          <dd className="text-right text-doqyn-text">
            {fileCount} {fileCount === 1 ? 'arquivo' : 'arquivos'}
          </dd>
        </div>
        {folder && (
          <div className="flex justify-between gap-4">
            <dt className="text-doqyn-subtle">Governança</dt>
            <dd className="text-right text-doqyn-text">Pasta de governança</dd>
          </div>
        )}
      </dl>

      {(folder || overview.categoryName) && (
        <Link
          to="/rules"
          className="mt-4 inline-flex items-center gap-1.5 text-[12px] text-doqyn-muted hover:text-doqyn-text hover:underline"
        >
          <Icon name="balance" size={ICON_SIZE.sm} />
          Ver regras desta categoria
        </Link>
      )}
    </div>
  );
}
