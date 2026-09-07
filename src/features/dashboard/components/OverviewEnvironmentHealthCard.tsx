import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import type { DashboardOverviewResponse } from '@/types/dashboard-overview';
import { OverviewLinkAction } from './OverviewLinkAction';
import { OverviewPanelShell } from './OverviewPanelShell';

type HealthIndicatorProps = {
  label: string;
  ok: boolean;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Quando false, indicadores de governança mostram acesso restrito em vez de ação de configuração. */
  canManage?: boolean;
};

/**
 * Atestado é texto, alerta é etiqueta. A pílula verde de "OK" repetida três
 * vezes gritava o que já é o esperado; agora o que preenche é o que precisa
 * de decisão.
 */
function HealthIndicator({
  label,
  ok,
  detail,
  actionLabel,
  onAction,
  canManage = true,
}: HealthIndicatorProps) {
  const restricted = !ok && !canManage;
  const resolvedDetail =
    detail ?? (restricted ? 'Configuração gerenciada pelo administrador' : undefined);

  return (
    <div className="overview-row flex items-center justify-between gap-3 py-3 pl-4 pr-1">
      <div className="min-w-0">
        <p className="text-label font-medium text-doqyn-text">{label}</p>
        {resolvedDetail && <p className="overview-row-meta mt-0.5">{resolvedDetail}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        {ok ? (
          <span className="overview-status-mark overview-status-mark--ok">OK</span>
        ) : restricted ? (
          <span className="overview-status-mark">Restrito</span>
        ) : (
          <span className="overview-status-tag">Atenção</span>
        )}
        {!ok && canManage && actionLabel && onAction && (
          <OverviewLinkAction onClick={onAction}>{actionLabel}</OverviewLinkAction>
        )}
      </div>
    </div>
  );
}

type OverviewEnvironmentHealthCardProps = {
  health: DashboardOverviewResponse['health'];
  bucketNameMasked?: string | null;
  canManageGovernance?: boolean;
};

export function OverviewEnvironmentHealthCard({
  health,
  bucketNameMasked,
  canManageGovernance = false,
}: OverviewEnvironmentHealthCardProps) {
  const navigate = useNavigate();

  return (
    <OverviewPanelShell
      title="Saúde do ambiente"
      subtitle="Integridade operacional"
      titleId="overview-health-title"
      bodyClassName="flex flex-col"
      data-testid="overview-environment-health"
    >
      <div className="flex flex-col">
        {/* Sem ação, e de propósito: `hasStorageConfigured` é `isStorageConfigured()`, uma
            checagem das credenciais do R2 no ambiente do servidor. Vale igual para todos os
            tenants e nenhum administrador a resolve por Configurações — o atalho que existia
            aqui levava a uma tela onde não há esse botão. Falta storage é assunto de quem
            opera o deploy, então o indicador acusa e para por aí. */}
        <HealthIndicator
          label="Storage"
          ok={health.hasStorageConfigured}
          detail={
            health.hasStorageConfigured
              ? 'Armazenamento configurado'
              : 'Indisponível no ambiente. Contate o suporte'
          }
        />
        <HealthIndicator
          label="Categorias"
          ok={health.hasActiveCategories}
          detail={
            health.hasActiveCategories
              ? 'Categorias ativas no ambiente'
              : canManageGovernance
                ? 'Crie ou ative categorias'
                : 'Aguardando configuração pelo administrador'
          }
          actionLabel="Regras"
          onAction={
            !health.hasActiveCategories && canManageGovernance
              ? () => navigate('/rules')
              : undefined
          }
          canManage={canManageGovernance}
        />
        <HealthIndicator
          label="Regras de IA"
          ok={health.hasActiveExtractionRules}
          detail={
            health.hasActiveExtractionRules
              ? 'Extração configurada no ambiente'
              : canManageGovernance
                ? 'Ative regras de análise'
                : 'Aguardando configuração pelo administrador'
          }
          actionLabel="Upload e IA"
          onAction={
            !health.hasActiveExtractionRules && canManageGovernance
              ? () => navigate('/settings?section=upload-ia')
              : undefined
          }
          canManage={canManageGovernance}
        />
      </div>

      {health.warnings.length > 0 && (
        <ul className="scrollbar-thin max-h-28 space-y-2 overflow-y-auto pt-3">
          {health.warnings.map((warning) => (
            <li
              key={warning}
              className="flex items-start gap-2 text-caption leading-relaxed text-doqyn-warning"
            >
              <Icon name="warning" size={ICON_SIZE.xs} className="mt-0.5 shrink-0" aria-hidden />
              <span>{warning}</span>
            </li>
          ))}
        </ul>
      )}

      {bucketNameMasked && (
        <p className={cn('overview-row-meta mt-auto pl-4 pt-3')}>
          Bucket <span className="font-mono text-micro text-doqyn-subtle">{bucketNameMasked}</span>
        </p>
      )}
    </OverviewPanelShell>
  );
}
