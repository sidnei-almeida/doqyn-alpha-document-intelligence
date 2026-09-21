import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import type { DashboardOverviewResponse } from '@/types/dashboard-overview';
import { formatStorageBytes } from '../utils/buildOverviewMetrics';
import { OverviewPanelShell } from './OverviewPanelShell';
import { EmptyHint } from '@/components/ui/EmptyHint';
import {
  OverviewPanelStat,
  OverviewPanelStatCell,
  OverviewPanelStatGrid,
} from './OverviewPanelStat';
import { useTranslation } from 'react-i18next';

type OverviewStoragePanelProps = {
  storage: NonNullable<DashboardOverviewResponse['storage']>;
  downloadsInPeriod: number;
  recentErrors: DashboardOverviewResponse['recentErrors'];
};

export function OverviewStoragePanel({
  storage,
  downloadsInPeriod,
  recentErrors,
}: OverviewStoragePanelProps) {
  const { t } = useTranslation('dashboard');

  const navigate = useNavigate();

  const errorStatus =
    recentErrors.length > 0 ? (
      <ul className="scrollbar-thin max-h-24 space-y-1.5 overflow-y-auto pr-1">
        {recentErrors.map((error) => (
          <li key={error.id}>
            <span className="font-medium text-doqyn-text">
              {error.documentName ?? t('overviewStoragePanel.documentFallback')}
            </span>
            <span className="text-doqyn-danger"> · {error.message}</span>
          </li>
        ))}
      </ul>
    ) : (
      <EmptyHint bare>{t('overviewStoragePanel.nenhumErroRecenteNo')}</EmptyHint>
    );

  return (
    <OverviewPanelShell
      title={t('overviewStoragePanel.storageEErrosRecentes')}
      subtitle={t('overviewStoragePanel.subtitle')}
      titleId="overview-storage-title"
      actionLabel={t('overviewStoragePanel.openTracking')}
      onAction={() => navigate('/tracking')}
      data-testid="overview-storage"
    >
      <OverviewPanelStatGrid columnsClassName="grid-cols-2 sm:grid-cols-4">
        <OverviewPanelStatCell>
          <OverviewPanelStat
            label={t('overviewStoragePanel.originais')}
            value={storage.originalFiles}
            hint={t('overviewStoragePanel.hintArquivos')}
            onClick={() => navigate('/library')}
          />
        </OverviewPanelStatCell>
        <OverviewPanelStatCell>
          <OverviewPanelStat
            label={t('overviewStoragePanel.previews')}
            value={storage.previewFiles}
            hint={t('overviewStoragePanel.hintGerados')}
            onClick={() => navigate('/library')}
          />
        </OverviewPanelStatCell>
        <OverviewPanelStatCell>
          <OverviewPanelStat
            label={t('overviewStoragePanel.tamanhoTotal')}
            value={formatStorageBytes(storage.totalSizeBytes)}
            hint={t('overviewStoragePanel.hintNoBucket')}
            valueClassName="text-h1 leading-tight"
          />
        </OverviewPanelStatCell>
        <OverviewPanelStatCell>
          <OverviewPanelStat
            label={t('overviewStoragePanel.downloads')}
            value={
              <span className="inline-flex items-center gap-1.5">
                <Icon
                  name="download"
                  size={ICON_SIZE.xs}
                  className="text-doqyn-muted"
                  aria-hidden
                />
                {downloadsInPeriod}
              </span>
            }
            hint={t('overviewStoragePanel.inPeriod')}
            onClick={() => navigate('/tracking')}
          />
        </OverviewPanelStatCell>
      </OverviewPanelStatGrid>

      <div className="border-t border-doqyn-border-subtle/75 px-4 py-3">
        <div className="min-h-[1.25rem] text-caption leading-relaxed">{errorStatus}</div>
      </div>
    </OverviewPanelShell>
  );
}
