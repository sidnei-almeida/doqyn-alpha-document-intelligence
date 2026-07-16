import { useRef } from 'react';
import { FileThumbnail } from '@/components/ui/FileThumbnail';
import { FileTypeIcon } from '@/components/ui/FileTypeIcon';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import type { DocumentListItem } from '@/types/document-library';
import { formatRelativeTime } from '../../utils/formatRelativeTime';

type HomeSuggestedCarouselProps = {
  documents: DocumentListItem[];
  onOpen: (doc: DocumentListItem) => void;
};

/** Carrossel "Sugeridos" — cards com preview real do documento, estilo Drive. */
export function HomeSuggestedCarousel({ documents, onOpen }: HomeSuggestedCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (documents.length === 0) return null;

  const scrollBy = (direction: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: direction * 272, behavior: 'smooth' });
  };

  return (
    <section aria-label="Sugeridos">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="type-h2">Sugeridos</h2>
        <div className="flex gap-1">
          <IconButton label="Anteriores" onClick={() => scrollBy(-1)}>
            <Icon name="chevron_left" size={18} />
          </IconButton>
          <IconButton label="Próximos" onClick={() => scrollBy(1)}>
            <Icon name="chevron_right" size={18} />
          </IconButton>
        </div>
      </div>
      <div ref={scrollRef} className="scrollbar-thin flex snap-x gap-3.5 overflow-x-auto pb-1.5">
        {documents.map((doc) => {
          const editorName = doc.updatedByName ?? doc.ownerName;
          return (
            <button
              key={doc.documentId}
              type="button"
              onClick={() => onOpen(doc)}
              className="group w-60 shrink-0 snap-start overflow-hidden rounded-xl border border-doqyn-border-subtle bg-doqyn-surface text-left transition-colors hover:border-doqyn-border"
            >
              <div className="h-32 w-full overflow-hidden bg-doqyn-thumbnail-chrome">
                <FileThumbnail
                  fileName={doc.currentFileName}
                  documentId={doc.documentId}
                  versionId={doc.latestVersionId ?? doc.currentVersionId}
                  canPreview={doc.permissions?.canPreview}
                  className="h-full w-full"
                />
              </div>
              <div className="flex items-center gap-2.5 border-t border-doqyn-border-subtle px-3 py-2.5">
                <FileTypeIcon fileName={doc.currentFileName} size={18} />
                <div className="min-w-0 flex-1">
                  <p className="type-label truncate text-doqyn-text">{doc.displayName}</p>
                  <p className="type-caption truncate text-doqyn-subtle">
                    {editorName ? `${editorName} · ` : ''}
                    {formatRelativeTime(doc.updatedAt)}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
