import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import type { DashboardPeriodKey } from '@/types/dashboard-overview';
import { OverviewPeriodSelector } from './OverviewPeriodSelector';

type OverviewHeaderActionsProps = {
  period: DashboardPeriodKey;
  onPeriodChange: (period: DashboardPeriodKey) => void;
};

export function OverviewHeaderActions({ period, onPeriodChange }: OverviewHeaderActionsProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <OverviewPeriodSelector value={period} onChange={onPeriodChange} />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="h-9"
        onClick={() => navigate('/biblioteca')}
      >
        <Icon name="local_library" size={ICON_SIZE.xs} />
        Ir para Biblioteca
      </Button>
    </div>
  );
}
