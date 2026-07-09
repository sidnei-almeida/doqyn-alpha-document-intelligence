import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import type { DashboardOverviewResponse } from '@/types/dashboard-overview';
import { OverviewPanelShell } from './OverviewPanelShell';

type GovernanceStatProps = {
  label: string;
  value: number;
  hint?: string;
  onClick?: () => void;
};

function GovernanceStat({ label, value, hint, onClick }: GovernanceStatProps) {
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className="overview-governance-stat flex h-full min-h-[5.75rem] flex-col justify-center px-3 py-3 text-left sm:px-4 sm:py-4"
    >
      <p className="overview-kpi-label">{label}</p>
      <p className="overview-governance-value mt-1 tabular-nums">{value}</p>
      {hint && <p className="overview-kpi-subtext mt-1 line-clamp-2">{hint}</p>}
    </Wrapper>
  );
}

type OverviewGovernancePanelProps = {
  governance: NonNullable<DashboardOverviewResponse['governance']>;
};

export function OverviewGovernancePanel({ governance }: OverviewGovernancePanelProps) {
  const navigate = useNavigate();
  const pendingTotal = governance.usersPending + governance.accessRequestsPending;

  return (
    <OverviewPanelShell
      title="Governança documental"
      subtitle="Categorias, regras e acesso do ambiente"
      titleId="overview-governance-title"
      actionLabel="Abrir mapa de regras"
      onAction={() => navigate('/rules')}
      data-testid="overview-governance"
    >
      <div className="grid grid-cols-2 gap-px bg-doqyn-border-subtle/50 sm:grid-cols-3 lg:grid-cols-6">
        <div className="bg-doqyn-surface/35">
          <GovernanceStat
            label="Categorias"
            value={governance.documentCategories}
            onClick={() => navigate('/rules')}
          />
        </div>
        <div className="bg-doqyn-surface/35">
          <GovernanceStat
            label="Grupos"
            value={governance.documentGroups}
            onClick={() => navigate('/users')}
          />
        </div>
        <div className="bg-doqyn-surface/35">
          <GovernanceStat
            label="Extração"
            value={governance.activeExtractionRules}
            hint="regras ativas"
            onClick={() => navigate('/settings?section=upload-ia')}
          />
        </div>
        <div className="bg-doqyn-surface/35">
          <GovernanceStat
            label="Acesso"
            value={governance.activeAccessRules}
            hint="regras ativas"
            onClick={() => navigate('/rules')}
          />
        </div>
        <div className="bg-doqyn-surface/35">
          <GovernanceStat
            label="Usuários"
            value={governance.usersActive}
            hint="ativos"
            onClick={() => navigate('/users')}
          />
        </div>
        <div className="bg-doqyn-surface/35">
          <GovernanceStat
            label="Pendências"
            value={pendingTotal}
            hint={`${governance.usersPending} usuários · ${governance.accessRequestsPending} acessos`}
            onClick={() => navigate('/users')}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-doqyn-border-subtle/60 px-4 py-3 sm:px-5">
        {[
          { label: 'Mapa de regras', path: '/rules' },
          { label: 'Usuários', path: '/users' },
          { label: 'Upload e IA', path: '/settings?section=upload-ia' },
        ].map((item) => (
          <button
            key={item.path}
            type="button"
            onClick={() => navigate(item.path)}
            className="inline-flex items-center gap-1 rounded-full border border-doqyn-border-subtle bg-doqyn-bg/50 px-3 py-1.5 text-xs font-medium text-doqyn-text hover:bg-doqyn-surface-hover"
          >
            {item.label}
            <Icon name="chevron_right" size={14} className="text-doqyn-subtle" aria-hidden />
          </button>
        ))}
      </div>
    </OverviewPanelShell>
  );
}
