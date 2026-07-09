import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import type { DashboardOverviewResponse } from '@/types/dashboard-overview';
import { formatStorageBytes } from '../utils/buildOverviewMetrics';
import { OverviewPanelShell } from './OverviewPanelShell';

type OverviewStoragePanelProps = {
  storage: NonNullable<DashboardOverviewResponse['storage']>;
  downloadsInPeriod: number;
  recentErrors: DashboardOverviewResponse['recentErrors'];
  showRulesCta: boolean;
};

export function OverviewStoragePanel({
  storage,
  downloadsInPeriod,
  recentErrors,
  showRulesCta,
}: OverviewStoragePanelProps) {
  const navigate = useNavigate();

  return (
    <OverviewPanelShell
      title="Storage e erros recentes"
      subtitle="Uso de arquivos e incidentes no período"
      titleId="overview-storage-title"
      className="h-full"
      variant="muted"
      action={
        showRulesCta ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => navigate('/rules')}>
            Configurar regras
          </Button>
        ) : undefined
      }
      data-testid="overview-storage"
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <div>
          <dt className="overview-kpi-label">Originais</dt>
          <dd className="overview-governance-value mt-1">{storage.originalFiles}</dd>
        </div>
        <div>
          <dt className="overview-kpi-label">Previews</dt>
          <dd className="overview-governance-value mt-1">{storage.previewFiles}</dd>
        </div>
        <div>
          <dt className="overview-kpi-label">Tamanho total</dt>
          <dd className="overview-stat-text mt-1">{formatStorageBytes(storage.totalSizeBytes)}</dd>
        </div>
        <div>
          <dt className="overview-kpi-label">Downloads</dt>
          <dd className="overview-stat-text mt-1 flex items-center gap-1.5 tabular-nums">
            <Icon name="download" size={ICON_SIZE.xs} className="text-doqyn-muted" aria-hidden />
            {downloadsInPeriod}
          </dd>
        </div>
      </dl>

      <div className="mt-4 min-h-[4.5rem] border-t border-doqyn-border-subtle/60 pt-3">
        {recentErrors.length > 0 ? (
          <ul className="max-h-32 space-y-2 overflow-y-auto pr-1 text-sm leading-relaxed scrollbar-thin">
            {recentErrors.map((error) => (
              <li key={error.id} className="text-doqyn-danger">
                <span className="font-medium">{error.documentName ?? 'Documento'}</span>
                {' — '}
                {error.message}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-doqyn-muted">Nenhum erro recente no período.</p>
        )}
      </div>
    </OverviewPanelShell>
  );
}
