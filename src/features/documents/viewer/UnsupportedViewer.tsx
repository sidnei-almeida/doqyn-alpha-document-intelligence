import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import type { ViewerComponentProps } from './viewerRegistry';
import { useTranslation } from 'react-i18next';

export function UnsupportedViewer({ manifest, className }: ViewerComponentProps) {
  const { t } = useTranslation('documents');

  const canDownload = manifest.permissions.canDownload;

  return (
    <div
      className={`flex h-full flex-col items-center justify-center gap-4 px-6 text-center ${className ?? ''}`}
    >
      <Icon name="report" size={40} className="text-doqyn-muted" aria-hidden />
      <div>
        <p className="text-sm font-medium text-doqyn-text">
          {t('unsupportedViewer.esteTipoDeArquivo')}
        </p>
        <p className="mt-1 text-xs text-doqyn-muted">
          {t('unsupportedViewer.tipoDetectado')} {manifest.mimeType || 'desconhecido'}
        </p>
      </div>
      {canDownload && (
        <Button type="button" variant="secondary" size="sm" disabled>
          <Icon name="download" size={14} />

          {t('unsupportedViewer.baixarOriginal')}
        </Button>
      )}
    </div>
  );
}
