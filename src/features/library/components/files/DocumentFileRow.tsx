import type { KeyboardEvent, MouseEvent } from 'react';
import { cn } from '@/lib/utils';
import type { DocumentListItem } from '@/types/document-library';
import { useExplorerFileActions } from '../../context/useExplorerFileActions';
import { useSelectableItemRef } from '../../hooks/useSelectableItemRef';
import { handleExplorerItemKeyDown } from '../../utils/explorerItemKeyboard';
import { DocumentFileThumbnail } from './DocumentFileThumbnail';
import { DocumentFavoriteBadge } from './DocumentFavoriteBadge';
import { DocumentItemMenu } from './DocumentItemMenu';
import { documentDisplayName, documentSecondaryMeta } from './documentFileUtils';

type DocumentFileRowProps = {
  document: DocumentListItem;
  meta?: string;
  /** table = <tr> dentro de ExplorerFolderFiles; compact = div na home. */
  layout?: 'compact' | 'table';
};

/** Linha de arquivo — miniatura pequena + nome; usada em listas da Biblioteca. */
export function DocumentFileRow({
  document: doc,
  meta,
  layout = 'compact',
}: DocumentFileRowProps) {
  const { isFileSelected, interactFile, openFile, openFileContextMenu } = useExplorerFileActions();
  const isSelected = isFileSelected(doc.documentId);
  const selectableRef = useSelectableItemRef(doc.documentId, 'file');
  const name = documentDisplayName(doc);
  const secondary = documentSecondaryMeta(doc, meta);

  const handlers = {
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
    onKeyDown: (event: KeyboardEvent) =>
      handleExplorerItemKeyDown(event, {
        isSelected,
        onOpen: () => openFile(doc),
        onToggleSelect: () => interactFile(doc, { type: 'toggle' }),
      }),
  };

  if (layout === 'compact') {
    return (
      <div
        ref={selectableRef}
        role="option"
        tabIndex={0}
        data-explorer-item="file"
        data-explorer-item-id={doc.documentId}
        data-testid="document-file-row"
        {...handlers}
        className={cn(
          'group explorer-interactive relative flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-3 py-2 outline-none',
          'focus-visible:ring-2 focus-visible:ring-doqyn-accent-active/40 focus-visible:ring-offset-1 focus-visible:ring-offset-doqyn-bg',
          isSelected ? 'explorer-item-selected explorer-selected' : 'hover:bg-doqyn-surface-hover',
        )}
        aria-selected={isSelected}
      >
        {isSelected && (
          <span
            className="explorer-item-selected-accent absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-full bg-doqyn-accent-active"
            aria-hidden
          />
        )}
        <DocumentFileThumbnail document={doc} size="row" />
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1.5 truncate text-[13px] font-medium text-doqyn-text">
            <DocumentFavoriteBadge document={doc} variant="inline" />
            <span className="truncate">{name}</span>
          </p>
          <p className="truncate text-[11px] text-doqyn-subtle">{secondary}</p>
        </div>
        <DocumentItemMenu
          label={name}
          onOpen={(x, y) => openFileContextMenu(doc, x, y)}
          className="explorer-icon-btn shrink-0 opacity-0 group-hover:opacity-100"
        />
      </div>
    );
  }

  return null;
}

/** Célula de ícone para FileRow em modo tabela explorer. */
export function DocumentFileRowIcon({ document: doc }: { document: DocumentListItem }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-doqyn-thumbnail-chrome">
      <DocumentFileThumbnail document={doc} size="row" />
    </span>
  );
}
