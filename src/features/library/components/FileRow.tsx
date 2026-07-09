import type { KeyboardEvent, MouseEvent } from 'react';
import { Icon } from '@/components/ui/Icon';
import { DocumentFileRowIcon } from './files/DocumentFileRow';
import { DocumentFavoriteBadge } from './files/DocumentFavoriteBadge';
import { StatusPill } from '@/components/ui/StatusPill';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { cn, formatDate } from '@/lib/utils';
import type { DocumentStatus } from '@/types/document';
import type { DocumentListItem } from '@/types/document-library';
import { useExplorerFileActions } from '../context/useExplorerFileActions';
import { useSelectableItemRef } from '../hooks/useSelectableItemRef';
import { handleExplorerItemKeyDown } from '../utils/explorerItemKeyboard';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { FileTypeIcon } from '@/components/ui/FileTypeIcon';

type FileRowProps = {
  document: DocumentListItem;
  /** @deprecated use variant */
  compact?: boolean;
  variant?: 'default' | 'explorer';
};

function displayName(doc: DocumentListItem): string {
  return doc.currentFileName ?? doc.displayName;
}

function ownerName(doc: DocumentListItem): string {
  return doc.createdBy?.displayName ?? doc.ownerName ?? '—';
}

/** Linha de arquivo — clique seleciona, duplo clique abre viewer. */
export function FileRow({
  document: doc,
  compact = false,
  variant = 'default',
}: FileRowProps) {
  const {
    isFileSelected,
    isStarred,
    interactFile,
    openFile,
    openFileContextMenu,
    toggleStar,
  } = useExplorerFileActions();

  const isExplorer = variant === 'explorer' || compact;
  const isSelected = isFileSelected(doc.documentId);
  const selectableRef = useSelectableItemRef(doc.documentId, 'file');
  const name = displayName(doc);
  const starred = doc.isFavorite === true || isStarred(doc.documentId);

  const rowKeyHandlers = {
    onKeyDown: (event: KeyboardEvent) =>
      handleExplorerItemKeyDown(event, {
        isSelected,
        onOpen: () => openFile(doc),
        onToggleSelect: () => interactFile(doc, { type: 'toggle' }),
      }),
  };

  const pointerHandlers = {
    onClick: (event: MouseEvent) =>
      interactFile(doc, {
        type: 'activate',
        modifiers: {
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
        },
      }),
    onDoubleClick: (event: MouseEvent) => {
      event.stopPropagation();
      openFile(doc);
    },
    onContextMenu: (event: MouseEvent) => {
      event.preventDefault();
      openFileContextMenu(doc, event.clientX, event.clientY);
    },
  };

  if (isExplorer) {
    return (
      <tr
        ref={selectableRef}
        data-explorer-item="file"
        data-explorer-item-id={doc.documentId}
        tabIndex={0}
        role="row"
        {...pointerHandlers}
        {...rowKeyHandlers}
        className={cn(
          'group explorer-interactive cursor-pointer outline-none',
          'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-doqyn-accent-active/35',
          isSelected ? 'explorer-item-selected explorer-selected' : 'hover:bg-doqyn-surface-hover',
        )}
        aria-selected={isSelected}
      >
        <td className="relative rounded-l-lg px-3 py-2.5">
          {isSelected && (
            <span
              className="explorer-item-selected-accent absolute bottom-2 left-0 top-2 w-0.5 rounded-full bg-doqyn-accent-active"
              aria-hidden
            />
          )}
          <div className="flex items-center gap-2.5 pl-1">
            <DocumentFileRowIcon document={doc} />
            <div className="min-w-0 flex-1">
              <p className="flex min-w-0 items-center gap-1.5">
                <DocumentFavoriteBadge document={doc} variant="inline" />
                <TruncatedText className="min-w-0 flex-1 text-[13px] font-medium text-doqyn-text">{name}</TruncatedText>
              </p>
              <p className="meta-text mt-0.5 truncate md:hidden">
                {ownerName(doc)} · {formatDate(doc.updatedAt)}
              </p>
            </div>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                toggleStar(doc);
              }}
              className={cn(
                'explorer-icon-btn shrink-0 sm:opacity-0 sm:group-hover:opacity-100',
                starred && 'text-doqyn-warning opacity-100',
              )}
              aria-label={starred ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              aria-pressed={starred}
            >
              <Icon name="star" filled={starred} size={ICON_SIZE.sm} />
            </button>
          </div>
        </td>
        <td className="hidden px-3 py-2.5 text-[12px] text-doqyn-muted md:table-cell">
          {formatDate(doc.updatedAt)}
        </td>
        <td className="hidden px-3 py-2.5 sm:table-cell">
          <StatusPill status={(doc.status as DocumentStatus) ?? 'active'} className="scale-90" />
        </td>
        <td className="rounded-r-lg px-2 py-2.5">
          <button
            type="button"
            className="explorer-icon-btn shrink-0 opacity-0 group-hover:opacity-100 sm:opacity-0"
            aria-label={`Ações de ${name}`}
            onClick={(event) => {
              event.stopPropagation();
              const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
              openFileContextMenu(doc, rect.left, rect.bottom);
            }}
          >
            <Icon name="more_horiz" size={ICON_SIZE.sm} />
          </button>
        </td>
      </tr>
    );
  }

  const tags = Array.isArray(doc.metadata?.tags) ? (doc.metadata?.tags as string[]) : [];

  return (
    <tr
      ref={selectableRef}
      data-explorer-item="file"
      data-explorer-item-id={doc.documentId}
      tabIndex={0}
      role="row"
      {...pointerHandlers}
      {...rowKeyHandlers}
      className={cn(
        'group explorer-interactive cursor-pointer border-b border-doqyn-border-subtle outline-none',
        'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-doqyn-accent-active/35',
        isSelected ? 'explorer-item-selected explorer-selected' : 'hover:bg-doqyn-surface-hover',
      )}
      aria-selected={isSelected}
    >
      <td className="relative px-4 py-3.5">
        {isSelected && (
          <span
            className="explorer-item-selected-accent absolute bottom-2 left-0 top-2 w-0.5 rounded-full bg-doqyn-accent-active"
            aria-hidden
          />
        )}
        <div className="flex items-center gap-3 pl-1">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-doqyn-card">
            <FileTypeIcon fileName={name} className="h-4 w-4 text-doqyn-muted" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-center gap-1.5">
              <DocumentFavoriteBadge document={doc} variant="inline" />
              <TruncatedText className="min-w-0 flex-1 text-[14px] font-medium text-doqyn-text">{name}</TruncatedText>
            </p>
            <p className="meta-text mt-0.5 truncate">
              {ownerName(doc)} · {formatDate(doc.updatedAt)}
            </p>
          </div>
        </div>
      </td>
      <td className="hidden px-4 py-3 text-[12px] text-doqyn-muted lg:table-cell">{ownerName(doc)}</td>
      <td className="hidden px-4 py-3 lg:table-cell">
        {tags.length > 0 ? (
          <span className="text-[12px] text-doqyn-muted">{tags.slice(0, 3).join(', ')}</span>
        ) : (
          <span className="text-[12px] text-doqyn-subtle">—</span>
        )}
      </td>
      <td className="hidden px-4 py-3 text-[12px] text-doqyn-muted md:table-cell">
        {formatDate(doc.updatedAt)}
      </td>
      <td className="px-4 py-3">
        <StatusPill status={(doc.status as DocumentStatus) ?? 'active'} />
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          className="explorer-icon-btn shrink-0 opacity-0 group-hover:opacity-100"
          aria-label={`Ações de ${name}`}
          onClick={(event) => {
            event.stopPropagation();
            const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
            openFileContextMenu(doc, rect.left, rect.bottom);
          }}
        >
          <Icon name="more_horiz" size={ICON_SIZE.sm} />
        </button>
      </td>
    </tr>
  );
}
