import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import type { DashboardOverviewResponse } from '@/types/dashboard-overview';
import { formatStorageBytes } from '../utils/buildOverviewMetrics';
import { OverviewPanelShell } from './OverviewPanelShell';
import {
  OverviewPanelStat,
  OverviewPanelStatCell,
  OverviewPanelStatGrid,
} from './OverviewPanelStat';

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
  const navigate = useNavigate();

  const errorStatus =
    recentErrors.length > 0 ? (
      <ul className="scrollbar-thin max-h-24 space-y-1.5 overflow-y-auto pr-1 text-doqyn-danger">
        {recentErrors.map((error) => (
          <li key={error.id}>
            <span className="font-medium text-doqyn-text">{error.documentName ?? 'Documento'}</span>
            <span className="text-doqyn-danger"> — {error.message}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-doqyn-muted">Nenhum erro recente no período.</p>
    );

  return (
    <OverviewPanelShell
      title="Storage e erros recentes"
      subtitle="Uso de arquivos e incidentes no período"
      titleId="overview-storage-title"
      actionLabel="Abrir tracking"
      onAction={() => navigate('/tracking')}
      data-testid="overview-storage"
    >
      <OverviewPanelStatGrid columnsClassName="grid-cols-2 sm:grid-cols-4">
        <OverviewPanelStatCell>
          <OverviewPanelStat
            label="Originais"
            value={storage.originalFiles}
            hint="arquivos"
            onClick={() => navigate('/biblioteca')}
          />
        </OverviewPanelStatCell>
        <OverviewPanelStatCell>
          <OverviewPanelStat
            label="Previews"
            value={storage.previewFiles}
            hint="gerados"
            onClick={() => navigate('/biblioteca')}
          />
        </OverviewPanelStatCell>
        <OverviewPanelStatCell>
          <OverviewPanelStat
            label="Tamanho total"
            value={formatStorageBytes(storage.totalSizeBytes)}
            hint="no bucket"
            valueClassName="text-[1.35rem] leading-tight sm:text-[1.5rem]"
          />
        </OverviewPanelStatCell>
        <OverviewPanelStatCell>
          <OverviewPanelStat
            label="Downloads"
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
            hint="no período"
            onClick={() => navigate('/tracking')}
          />
        </OverviewPanelStatCell>
      </OverviewPanelStatGrid>

      <div className="border-doqyn-border-subtle/60 border-t px-4 py-3 sm:px-5">
        <div className="min-h-[1.25rem] text-sm leading-relaxed">{errorStatus}</div>
      </div>
    </OverviewPanelShell>
  );
}
