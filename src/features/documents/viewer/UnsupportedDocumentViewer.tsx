import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';

type UnsupportedDocumentViewerProps = {
  mimeType?: string;
  canDownload?: boolean;
  isDownloading?: boolean;
  onDownload?: () => void;
  className?: string;
};

export function UnsupportedDocumentViewer({
  mimeType,
  canDownload = false,
  isDownloading = false,
  onDownload,
  className,
}: UnsupportedDocumentViewerProps) {
  return (
    <div
      className={`flex h-full flex-col items-center justify-center gap-4 px-6 text-center ${className ?? ''}`}
    >
      <Icon name="report" size={40} className="text-doqyn-muted" aria-hidden />
      <div>
        <p className="text-sm font-medium text-doqyn-text">
          Este tipo de arquivo ainda não possui preview integrado.
        </p>
        {mimeType && (
          <p className="mt-1 text-xs text-doqyn-muted">Tipo detectado: {mimeType}</p>
        )}
      </div>
      {canDownload && onDownload && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={isDownloading}
          onClick={onDownload}
        >
          <Icon name="download" size={14} />
          Baixar original
        </Button>
      )}
    </div>
  );
}
