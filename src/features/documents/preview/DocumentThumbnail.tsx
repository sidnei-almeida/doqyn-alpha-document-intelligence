import { cn } from '@/lib/utils';
import { FileTypeIcon } from '@/components/ui/FileTypeIcon';
import type { DocumentPreviewStatus } from '@/types/document-library';
import { useDocumentThumbnail } from './useDocumentThumbnail';

export type DocumentThumbnailSize = 'card' | 'row' | 'large';

type DocumentThumbnailProps = {
  documentId?: string;
  versionId?: string;
  fileName: string;
  canPreview?: boolean;
  previewStatus?: DocumentPreviewStatus;
  size?: DocumentThumbnailSize;
  className?: string;
  iconClassName?: string;
};

const SIZE_ICON: Record<DocumentThumbnailSize, string> = {
  row: 'h-5 w-5',
  card: 'h-10 w-10',
  large: 'h-12 w-12',
};

/** Grid/card preenche o quadro (Drive-style); lista mantém contain. */
const SIZE_IMAGE_FIT: Record<DocumentThumbnailSize, string> = {
  row: 'object-contain object-center',
  card: 'object-cover object-center',
  large: 'object-cover object-center',
};

/** Miniatura autenticada (manifest + thumbnail) com fallback para ícone por tipo. */
export function DocumentThumbnail({
  documentId,
  versionId,
  fileName,
  canPreview = true,
  previewStatus,
  size = 'card',
  className,
  iconClassName,
}: DocumentThumbnailProps) {
  const previewBlocked =
    canPreview === false || previewStatus === 'failed' || previewStatus === 'skipped';

  const { containerRef, thumbnailUrl, state } = useDocumentThumbnail({
    fileName,
    documentId,
    versionId,
    canPreview: !previewBlocked,
  });

  const showImage = state === 'ready' && thumbnailUrl;
  const showProcessing = state === 'processing';
  const showLoading = state === 'loading';
  const iconSize = iconClassName ?? SIZE_ICON[size];

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden',
        size === 'row'
          ? 'rounded-md bg-doqyn-thumbnail-chrome'
          : 'h-full w-full rounded-none bg-transparent',
        className,
      )}
      data-testid="document-thumbnail"
      data-thumbnail-state={state}
      data-thumbnail-fit={size === 'row' ? 'contain' : 'cover'}
    >
      {showImage ? (
        <img
          src={thumbnailUrl}
          alt=""
          className={cn('h-full w-full', SIZE_IMAGE_FIT[size])}
          loading="lazy"
          draggable={false}
        />
      ) : (
        <FileTypeIcon fileName={fileName} className={cn(iconSize, 'text-doqyn-muted')} />
      )}

      {(showLoading || showProcessing) && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-doqyn-canvas/80"
          aria-hidden
        >
          <span className="skeleton-line h-full w-full animate-pulse bg-doqyn-surface-hover/50" />
          {showProcessing && size !== 'row' && (
            <span className="absolute bottom-2 px-2 text-center text-[10px] text-doqyn-subtle">
              Preparando visualização
            </span>
          )}
        </div>
      )}

      {previewBlocked && size !== 'row' && (
        <span className="sr-only">Visualização não disponível</span>
      )}
    </div>
  );
}
