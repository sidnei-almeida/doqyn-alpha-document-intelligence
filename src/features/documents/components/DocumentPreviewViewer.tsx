import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import { resolveViewerComponent } from '../viewer/viewerRegistry';
import { usePreviewManifest } from '../viewer/usePreviewManifest';

type DocumentPreviewViewerProps = {
  documentId: string;
  versionId: string;
  fileName?: string;
  canDownload?: boolean;
  onDownload?: () => void;
  className?: string;
  variant?: 'standalone' | 'embedded';
};

export function DocumentPreviewViewer({
  documentId,
  versionId,
  className,
  variant = 'standalone',
}: DocumentPreviewViewerProps) {
  const isEmbedded = variant === 'embedded';
  const manifestQuery = usePreviewManifest({
    documentId,
    versionId,
    enabled: true,
  });

  if (manifestQuery.isLoading) {
    return (
      <section
        className={cn(
          'flex items-center justify-center',
          isEmbedded ? 'h-full min-h-0' : 'min-h-[50vh] rounded-lg border border-doqyn-border',
          className,
        )}
      >
        <div className="flex items-center gap-2 text-sm text-doqyn-muted">
          <Icon name="progress_activity" size={ICON_SIZE.xs} className="animate-spin" />
          Carregando preview...
        </div>
      </section>
    );
  }

  if (manifestQuery.isError || !manifestQuery.data) {
    return (
      <section
        className={cn(
          'flex items-center justify-center px-6 text-center text-sm text-doqyn-danger',
          isEmbedded ? 'h-full min-h-0' : 'min-h-[40vh] rounded-lg border border-doqyn-border',
          className,
        )}
      >
        Não foi possível carregar o preview.
      </section>
    );
  }

  const manifest = manifestQuery.data;
  const ViewerComponent = resolveViewerComponent(manifest);

  return (
    <section
      className={cn(
        'overflow-hidden',
        isEmbedded ? 'h-full min-h-0' : 'min-h-[70vh] rounded-lg border border-doqyn-border',
        className,
      )}
      aria-label="Visualização do documento"
    >
      <ViewerComponent manifest={manifest} className="h-full min-h-0" />
    </section>
  );
}
