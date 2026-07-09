import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import type { DashboardOverviewResponse } from '@/types/dashboard-overview';
import { OverviewPanelShell } from './OverviewPanelShell';

type HealthIndicatorProps = {
  label: string;
  ok: boolean;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
};

function HealthIndicator({ label, ok, detail, actionLabel, onAction }: HealthIndicatorProps) {
  return (
    <div className="overview-health-row flex items-center justify-between gap-3 rounded-lg px-1 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <Icon
          name={ok ? 'check_circle' : 'circle'}
          filled={ok}
          size={ICON_SIZE.md}
          className={cn(
            'shrink-0',
            ok ? 'text-emerald-600/80 dark:text-emerald-400/80' : 'text-doqyn-warning',
          )}
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-doqyn-text">{label}</p>
          {detail && <p className="text-xs text-doqyn-muted">{detail}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={cn(
            'overview-health-badge',
            ok ? 'overview-health-badge--ok' : 'overview-health-badge--pending',
          )}
        >
          {ok ? 'OK' : 'Atenção'}
        </span>
        {!ok && actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="overview-health-action flex items-center gap-0.5 text-xs font-medium text-doqyn-primary hover:underline"
          >
            {actionLabel}
            <Icon name="chevron_right" size={14} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

type OverviewEnvironmentHealthCardProps = {
  health: DashboardOverviewResponse['health'];
  bucketNameMasked?: string | null;
};

export function OverviewEnvironmentHealthCard({
  health,
  bucketNameMasked,
}: OverviewEnvironmentHealthCardProps) {
  const navigate = useNavigate();

  return (
    <OverviewPanelShell
      title="Saúde do ambiente"
      subtitle="Integridade operacional"
      titleId="overview-health-title"
      className="h-full"
      bodyClassName="flex flex-col gap-3 px-4 pb-4 pt-0 sm:px-5 sm:pb-5"
      data-testid="overview-environment-health"
    >
      <div className="space-y-1">
        <HealthIndicator
          label="Storage"
          ok={health.hasStorageConfigured}
          detail={health.hasStorageConfigured ? 'Armazenamento configurado' : 'Verifique integração'}
          actionLabel="Sistema"
          onAction={
            !health.hasStorageConfigured
              ? () => navigate('/settings?section=sistema')
              : undefined
          }
        />
        <HealthIndicator
          label="Categorias"
          ok={health.hasActiveCategories}
          detail={health.hasActiveCategories ? 'Categorias ativas' : 'Crie ou ative categorias'}
          actionLabel="Regras"
          onAction={
            !health.hasActiveCategories ? () => navigate('/rules') : undefined
          }
        />
        <HealthIndicator
          label="Regras de IA"
          ok={health.hasActiveExtractionRules}
          detail={health.hasActiveExtractionRules ? 'Extração configurada' : 'Ative regras de análise'}
          actionLabel="Upload e IA"
          onAction={
            !health.hasActiveExtractionRules
              ? () => navigate('/settings?section=upload-ia')
              : undefined
          }
        />
      </div>

      {bucketNameMasked && (
        <p className="text-xs text-doqyn-muted border-t border-doqyn-border-subtle/70 pt-3">
          Bucket: <span className="font-medium text-doqyn-text">{bucketNameMasked}</span>
        </p>
      )}

      {health.warnings.length > 0 && (
        <ul className="overview-health-warnings max-h-28 space-y-2 overflow-y-auto border-t border-doqyn-border-subtle/70 pt-3 scrollbar-thin">
          {health.warnings.map((warning) => (
            <li
              key={warning}
              className="flex items-start gap-2 text-xs leading-relaxed text-doqyn-warning"
            >
              <Icon name="warning" size={ICON_SIZE.xs} className="mt-0.5 shrink-0" aria-hidden />
              <span>{warning}</span>
            </li>
          ))}
        </ul>
      )}
    </OverviewPanelShell>
  );
}
