import { Download, FileWarning } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { ViewerComponentProps } from './viewerRegistry';

export function UnsupportedViewer({ manifest, className }: ViewerComponentProps) {
  const canDownload = manifest.permissions.canDownload;

  return (
    <div
      className={`flex h-full flex-col items-center justify-center gap-4 px-6 text-center ${className ?? ''}`}
    >
      <FileWarning className="h-10 w-10 text-doqyn-muted" aria-hidden />
      <div>
        <p className="text-sm font-medium text-doqyn-text">
          Este tipo de arquivo ainda não possui visualização integrada.
        </p>
        <p className="mt-1 text-xs text-doqyn-muted">
          Tipo detectado: {manifest.mimeType || 'desconhecido'}
        </p>
      </div>
      {canDownload && (
        <Button type="button" variant="secondary" size="sm" disabled>
          <Download className="h-3.5 w-3.5" />
          Baixar original
        </Button>
      )}
    </div>
  );
}
