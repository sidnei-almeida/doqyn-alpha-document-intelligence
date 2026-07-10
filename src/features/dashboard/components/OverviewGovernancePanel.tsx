import { useNavigate } from 'react-router-dom';
import type { DashboardOverviewResponse } from '@/types/dashboard-overview';
import { OverviewPanelShell } from './OverviewPanelShell';
import {
  OverviewPanelFooter,
  OverviewPanelStat,
  OverviewPanelStatCell,
  OverviewPanelStatGrid,
} from './OverviewPanelStat';

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
      <OverviewPanelStatGrid>
        <OverviewPanelStatCell>
          <OverviewPanelStat
            label="Categorias"
            value={governance.documentCategories}
            onClick={() => navigate('/rules')}
          />
        </OverviewPanelStatCell>
        <OverviewPanelStatCell>
          <OverviewPanelStat
            label="Grupos"
            value={governance.documentGroups}
            onClick={() => navigate('/users')}
          />
        </OverviewPanelStatCell>
        <OverviewPanelStatCell>
          <OverviewPanelStat
            label="Extração"
            value={governance.activeExtractionRules}
            hint="regras ativas"
            onClick={() => navigate('/settings?section=upload-ia')}
          />
        </OverviewPanelStatCell>
        <OverviewPanelStatCell>
          <OverviewPanelStat
            label="Acesso"
            value={governance.activeAccessRules}
            hint="regras ativas"
            onClick={() => navigate('/rules')}
          />
        </OverviewPanelStatCell>
        <OverviewPanelStatCell>
          <OverviewPanelStat
            label="Usuários"
            value={governance.usersActive}
            hint="ativos"
            onClick={() => navigate('/users')}
          />
        </OverviewPanelStatCell>
        <OverviewPanelStatCell>
          <OverviewPanelStat
            label="Pendências"
            value={pendingTotal}
            hint={`${governance.usersPending} usuários · ${governance.accessRequestsPending} acessos`}
            onClick={() => navigate('/users')}
          />
        </OverviewPanelStatCell>
      </OverviewPanelStatGrid>

      <OverviewPanelFooter
        links={[
          { label: 'Mapa de regras', path: '/rules' },
          { label: 'Usuários', path: '/users' },
          { label: 'Upload e IA', path: '/settings?section=upload-ia' },
        ]}
        onNavigate={navigate}
      />
    </OverviewPanelShell>
  );
}
