import type { KeyboardEvent, MouseEvent } from 'react';
import { BadgeGroup } from '@/components/ui/BadgeGroup';
import { StatusPill } from '@/components/ui/StatusPill';
import { VersionBadge } from '@/components/ui/VersionBadge';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { cn } from '@/lib/utils';
import type { DocumentStatus } from '@/types/document';
import type { DocumentListItem } from '@/types/document-library';
import { useExplorerFileActions } from '../../context/useExplorerFileActions';
import { useSelectableItemRef } from '../../hooks/useSelectableItemRef';
import { ExplorerFileQuickActions } from '../ExplorerFileQuickActions';
import { ExplorerSelectionIndicator } from '../ExplorerSelectionIndicator';
import { handleExplorerItemKeyDown } from '../../utils/explorerItemKeyboard';
import { DocumentFileThumbnail } from './DocumentFileThumbnail';
import { DocumentFavoriteBadge } from './DocumentFavoriteBadge';
import { DocumentSignatureBadge } from './DocumentSignatureBadge';
import {
  documentDisplayName,
  documentOwnerName,
  documentSecondaryMeta,
} from './documentFileUtils';

type DocumentFileCardProps = {
  document: DocumentListItem;
  /** Metadado secundário customizado (ex.: "Sem pasta · data"). */
  meta?: string;
  showStatus?: boolean;
};

/**
 * Card compacto de arquivo — preview no topo, nome no rodapé.
 * Seleção premium via ExplorerActionsContext (sem prop drilling).
 */
export function DocumentFileCard({
  document: doc,
  meta,
  showStatus = false,
}: DocumentFileCardProps) {
  const {
    isFileSelected,
    interactFile,
    openFile,
    previewFile,
    downloadFile,
    openFileDetails,
    openFileContextMenu,
    openSignatures,
  } = useExplorerFileActions();

  const isSelected = isFileSelected(doc.documentId);
  const selectableRef = useSelectableItemRef(doc.documentId, 'file');
  const name = documentDisplayName(doc);
  const secondary = documentSecondaryMeta(doc, meta);

  return (
    <div
      ref={selectableRef}
      role="option"
      tabIndex={0}
      data-explorer-item="file"
      data-explorer-item-id={doc.documentId}
      data-testid="document-file-card"
      onClick={(event: MouseEvent) =>
        interactFile(doc, {
          type: 'activate',
          modifiers: {
            metaKey: event.metaKey,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
          },
        })
      }
      onDoubleClick={(event) => {
        event.stopPropagation();
        openFile(doc);
      }}
      onKeyDown={(event: KeyboardEvent) =>
        handleExplorerItemKeyDown(event, {
          isSelected,
          onOpen: () => openFile(doc),
          onToggleSelect: () => interactFile(doc, { type: 'toggle' }),
        })
      }
      onContextMenu={(event) => {
        event.preventDefault();
        openFileContextMenu(doc, event.clientX, event.clientY);
      }}
      className={cn(
        'group document-file-card explorer-file-card explorer-interactive relative flex w-full max-w-[240px] cursor-pointer flex-col rounded-xl border p-2 text-left outline-none active:scale-[0.99]',
        'border-transparent bg-doqyn-surface shadow-sm',
        'focus-visible:ring-2 focus-visible:ring-doqyn-accent-active/40 focus-visible:ring-offset-2 focus-visible:ring-offset-doqyn-bg',
        isSelected
          ? 'explorer-item-selected explorer-selected'
          : 'hover:bg-doqyn-surface-hover hover:shadow-md',
      )}
      aria-selected={isSelected}
    >
      <ExplorerSelectionIndicator visible={isSelected} />

      <ExplorerFileQuickActions
        document={doc}
        onPreview={() => previewFile(doc)}
        onDetails={() => openFileDetails(doc)}
        onDownload={() => downloadFile(doc)}
        onMore={(x, y) => openFileContextMenu(doc, x, y)}
      />

      <div
        className={cn(
          'document-file-card__preview relative mb-2 aspect-[4/3] w-full overflow-hidden rounded-[10px] bg-doqyn-thumbnail-chrome',
          isSelected && 'explorer-item-selected__preview',
        )}
      >
        <DocumentFileThumbnail document={doc} size="card" className="absolute inset-0" />
        <DocumentFavoriteBadge document={doc} variant="overlay" />
      </div>

      <TruncatedText className="px-0.5 text-[12px] font-medium leading-snug text-doqyn-text">
        {name}
      </TruncatedText>
      <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5 px-0.5">
        <span className="truncate text-[11px] text-doqyn-subtle">{secondary}</span>
        <DocumentSignatureBadge
          summary={doc.signatureSummary}
          size="xs"
          onClick={openSignatures ? () => openSignatures(doc) : undefined}
        />
      </p>

      {showStatus && (
        <div className="mt-1.5 flex items-center justify-between gap-2 px-0.5">
          <span className="truncate text-[10px] text-doqyn-subtle">{documentOwnerName(doc)}</span>
          <BadgeGroup align="end">
            <StatusPill status={(doc.status as DocumentStatus) ?? 'active'} size="xs" dot />
            <VersionBadge
              version={doc.currentVersionLabel ?? doc.versionLabel ?? `v${doc.version}`}
              isCurrent
              size="xs"
            />
          </BadgeGroup>
        </div>
      )}
    </div>
  );
}
