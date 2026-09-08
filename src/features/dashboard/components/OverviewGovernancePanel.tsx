import { useNavigate } from 'react-router-dom';
import type { DashboardOverviewResponse } from '@/types/dashboard-overview';
import { OverviewPanelShell } from './OverviewPanelShell';
import {
  OverviewPanelStat,
  OverviewPanelStatCell,
  OverviewPanelStatGrid,
} from './OverviewPanelStat';
import { useTranslation } from 'react-i18next';

type OverviewGovernancePanelProps = {
  governance: NonNullable<DashboardOverviewResponse['governance']>;
};

export function OverviewGovernancePanel({ governance }: OverviewGovernancePanelProps) {
  const { t } = useTranslation('dashboard');

  const navigate = useNavigate();

  return (
    <OverviewPanelShell
      title={t('overviewGovernancePanel.governancaDocumental')}
      subtitle="Categorias, regras e acesso do ambiente"
      titleId="overview-governance-title"
      actionLabel="Abrir mapa de regras"
      onAction={() => navigate('/rules')}
      data-testid="overview-governance"
    >
      <OverviewPanelStatGrid>
        <OverviewPanelStatCell>
          <OverviewPanelStat
            label={t('overviewGovernancePanel.categorias')}
            value={governance.documentCategories}
            onClick={() => navigate('/rules')}
          />
        </OverviewPanelStatCell>
        <OverviewPanelStatCell>
          <OverviewPanelStat
            label={t('overviewGovernancePanel.grupos')}
            value={governance.documentGroups}
            onClick={() => navigate('/users')}
          />
        </OverviewPanelStatCell>
        <OverviewPanelStatCell>
          <OverviewPanelStat
            label={t('overviewGovernancePanel.extracao')}
            value={governance.activeExtractionRules}
            hint="regras ativas"
            onClick={() => navigate('/settings?section=upload-ia')}
          />
        </OverviewPanelStatCell>
        <OverviewPanelStatCell>
          <OverviewPanelStat
            label={t('overviewGovernancePanel.acesso')}
            value={governance.activeAccessRules}
            hint="regras ativas"
            onClick={() => navigate('/rules')}
          />
        </OverviewPanelStatCell>
        <OverviewPanelStatCell>
          <OverviewPanelStat
            label={t('overviewGovernancePanel.usuarios')}
            value={governance.usersActive}
            hint="ativos"
            onClick={() => navigate('/users')}
          />
        </OverviewPanelStatCell>
        <OverviewPanelStatCell>
          <OverviewPanelStat
            label={t('overviewGovernancePanel.pendencias')}
            value={governance.usersPending}
            hint="usuários aguardando"
            onClick={() => navigate('/users')}
          />
        </OverviewPanelStatCell>
      </OverviewPanelStatGrid>
    </OverviewPanelShell>
  );
}
