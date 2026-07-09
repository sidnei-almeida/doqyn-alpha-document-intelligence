import { DocumentThumbnail } from '@/features/documents/preview/DocumentThumbnail';
import type { DocumentListItem } from '@/types/document-library';
import { cn } from '@/lib/utils';
import {
  documentCanPreview,
  documentDisplayName,
  resolveDocumentVersionId,
} from './documentFileUtils';

type DocumentFileThumbnailProps = {
  document: DocumentListItem;
  size?: 'card' | 'row';
  className?: string;
};

/** Miniatura padronizada — cover no grid, contain na lista. */
export function DocumentFileThumbnail({
  document: doc,
  size = 'card',
  className,
}: DocumentFileThumbnailProps) {
  const name = documentDisplayName(doc);
  const versionId = resolveDocumentVersionId(doc);

  return (
    <DocumentThumbnail
      fileName={name}
      documentId={doc.documentId}
      versionId={versionId}
      canPreview={documentCanPreview(doc)}
      previewStatus={doc.preview?.status}
      size={size}
      className={cn(
        'document-file-thumbnail',
        size === 'card' && 'h-full w-full',
        size === 'row' && 'h-8 w-8 rounded-md bg-doqyn-thumbnail-chrome p-0.5',
        className,
      )}
      iconClassName={size === 'row' ? 'h-4 w-4 text-doqyn-muted' : 'h-8 w-8 text-doqyn-muted'}
    />
  );
}
