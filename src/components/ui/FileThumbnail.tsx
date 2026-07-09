import { cn } from '@/lib/utils';
import { DocumentThumbnail } from '@/features/documents/preview/DocumentThumbnail';
import { FileTypeIcon } from './FileTypeIcon';

type FileThumbnailProps = {
  fileName: string;
  documentId?: string;
  versionId?: string;
  canPreview?: boolean;
  isFolder?: boolean;
  className?: string;
  iconClassName?: string;
  accentColor?: string;
};

/** Wrapper de compatibilidade — delega para DocumentThumbnail. */
export function FileThumbnail({
  fileName,
  documentId,
  versionId,
  canPreview = true,
  isFolder = false,
  className,
  iconClassName,
  accentColor,
}: FileThumbnailProps) {
  if (isFolder) {
    return (
      <div
        className={cn(
          'relative flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-doqyn-card',
          className,
        )}
      >
        <FileTypeIcon fileName={fileName} isFolder color={accentColor} className={iconClassName} />
      </div>
    );
  }

  return (
    <DocumentThumbnail
      fileName={fileName}
      documentId={documentId}
      versionId={versionId}
      canPreview={canPreview}
      size="card"
      className={className}
      iconClassName={iconClassName}
    />
  );
}
