import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { VersionBadge } from '@/components/ui/VersionBadge';
import { cn, formatDateTime } from '@/lib/utils';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { listDocumentVersions } from '@/features/documents/api/documentsApi';
import type { DocumentListItem } from '@/types/document-library';
import { useTranslation } from 'react-i18next';

type DocumentVersionHistoryPanelProps = {
  document: DocumentListItem;
  onPreviewVersion?: (versionId: string) => void;
  fillHeight?: boolean;
};

export function DocumentVersionHistoryPanel({
  document,
  onPreviewVersion,
  fillHeight = false,
}: DocumentVersionHistoryPanelProps) {
  const { t } = useTranslation('library');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['document-versions', document.documentId],
    queryFn: () => listDocumentVersions(document.documentId),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <p className="py-2 text-[12px] text-doqyn-muted">
        {t('documentVersionHistoryPanel.carregandoHistoricoDeVersoes')}
      </p>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-2 py-2">
        <p className="text-[12px] text-doqyn-danger">
          {t('documentVersionHistoryPanel.naoFoiPossivelCarregar')}
        </p>
        <Button type="button" size="sm" variant="secondary" onClick={() => void refetch()}>
          {t('documentVersionHistoryPanel.tentarNovamente')}
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col', fillHeight && 'min-h-0 flex-1')}>
      <p className="mb-2 shrink-0 text-[12px] text-doqyn-muted">
        {data.versionCount} {t('documentVersionHistoryPanel.versao')}
        {data.versionCount === 1 ? '' : 'ões'} {t('documentVersionHistoryPanel.atual')}{' '}
        <span className="font-medium text-doqyn-text">{data.currentVersionLabel}</span>
      </p>

      <ul
        className={cn(
          'space-y-2',
          fillHeight
            ? 'scrollbar-thin min-h-0 flex-1 overflow-y-auto pr-1'
            : 'max-h-64 overflow-y-auto pr-1',
        )}
      >
        {data.versions.map((version) => (
          <li
            key={version.versionId}
            className="flex items-start justify-between gap-3 rounded-lg border border-doqyn-border-subtle bg-doqyn-bg/40 px-3 py-2"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <VersionBadge
                  version={version.versionLabel ?? `v${version.versionId}`}
                  isCurrent={version.isCurrent}
                />
                {version.isCurrent && (
                  <span className="text-[10px] uppercase tracking-wide text-doqyn-primary">
                    {t('documentVersionHistoryPanel.current')}
                  </span>
                )}
              </div>
              <p className="mt-1 truncate text-[12px] font-medium text-doqyn-text">
                {version.finalFileName ?? version.originalFileName ?? '—'}
              </p>
              <p className="text-[11px] text-doqyn-muted">
                {version.createdAt ? formatDateTime(version.createdAt) : '—'}
                {version.createdByDisplayName ? ` · ${version.createdByDisplayName}` : ''}
              </p>
            </div>
            {onPreviewVersion && version.versionId && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="shrink-0"
                onClick={() => onPreviewVersion(version.versionId)}
                title={t('documentVersionHistoryPanel.visualizarEstaVersao')}
              >
                <Icon name="visibility" size={ICON_SIZE.sm} />
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
