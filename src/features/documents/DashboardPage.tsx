import { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { useNavigate } from 'react-router-dom';
import { PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/Button';
import { DocumentViewerModal } from '@/features/documents/viewer';
import { useDashboardOverview } from '@/features/dashboard/hooks/useDashboardOverview';
import { OverviewEnvironmentHealthCard } from '@/features/dashboard/components/OverviewEnvironmentHealthCard';
import { OverviewGovernancePanel } from '@/features/dashboard/components/OverviewGovernancePanel';
import { OverviewHeaderActions } from '@/features/dashboard/components/OverviewHeaderActions';
import { OverviewDistributionPanel } from '@/features/dashboard/components/OverviewDistributionPanel';
import { OverviewQuickAccessPanel } from '@/features/dashboard/components/OverviewQuickAccessPanel';
import { OverviewRecentActivityPanel } from '@/features/dashboard/components/OverviewRecentActivityPanel';
import { OverviewRecentDocumentsPanel } from '@/features/dashboard/components/OverviewRecentDocumentsPanel';
import { OverviewStoragePanel } from '@/features/dashboard/components/OverviewStoragePanel';
import { OverviewSummaryStrip } from '@/features/dashboard/components/OverviewSummaryStrip';
import { buildOverviewMetrics } from '@/features/dashboard/utils/buildOverviewMetrics';
import type { DashboardPeriodKey } from '@/types/dashboard-overview';
import type { DocumentListItem } from '@/types/document-library';

export function DashboardPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<DashboardPeriodKey>('30d');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const { data, isLoading, isError, refetch, isFetching } = useDashboardOverview(period);

  const metrics = useMemo(
    () => (data ? buildOverviewMetrics(data, period) : []),
    [data, period],
  );

  const openDocument = (doc: DocumentListItem) => {
    if (!doc.permissions?.canPreview) return;
    setSelectedDocId(doc.documentId);
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-doqyn-muted">
          <Icon name="progress_activity" size={ICON_SIZE.xs} className="animate-spin" />
          Carregando visão geral...
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-doqyn-danger">Não foi possível carregar a visão geral agora.</p>
        <Button type="button" variant="secondary" size="sm" onClick={() => void refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  const isEmpty = data.summary.totalDocuments === 0;
  const isAdmin = data.mode === 'full';

  return (
    <PageShell
      eyebrow="Visão geral"
      title="Painel de controle"
      description={`Panorama de ${data.tenant.displayName} — documentos, atividade e governança`}
      actions={<OverviewHeaderActions period={period} onPeriodChange={setPeriod} />}
      bodyClassName="overview-page w-full gap-6"
    >
      {isFetching && !isLoading && (
        <p className="shrink-0 text-xs text-doqyn-subtle" aria-live="polite">
          Atualizando métricas…
        </p>
      )}

      <OverviewSummaryStrip metrics={metrics} onNavigate={(path) => navigate(path)} />

      <div className="overview-main-grid grid min-h-0 flex-1 gap-6 xl:grid-cols-[1.55fr_1fr] xl:items-stretch">
        <OverviewRecentDocumentsPanel
          documents={data.recentDocuments}
          isEmpty={isEmpty}
          onOpen={openDocument}
        />
        <OverviewRecentActivityPanel events={data.recentTrackingEvents} />
      </div>

      <div className="overview-insights-grid grid gap-6 lg:grid-cols-2 xl:grid-cols-12 xl:items-stretch">
        <div className="lg:col-span-1 xl:col-span-3">
          <OverviewDistributionPanel
            title="Por status"
            items={data.documentsByStatus.map((item) => ({
              label: item.label,
              count: item.count,
            }))}
            emptyLabel="Nenhum documento no período."
          />
        </div>
        <div className="lg:col-span-1 xl:col-span-3">
          <OverviewDistributionPanel
            title="Por categoria"
            items={data.documentsByCategory.map((item) => ({
              label: item.categoryName,
              count: item.count,
            }))}
            emptyLabel="Nenhuma categoria com documentos."
          />
        </div>
        <div className="lg:col-span-1 xl:col-span-3">
          <OverviewEnvironmentHealthCard
            health={data.health}
            bucketNameMasked={data.storage?.bucketNameMasked}
          />
        </div>
        <div className="lg:col-span-1 xl:col-span-3">
          <OverviewQuickAccessPanel isAdmin={isAdmin} />
        </div>
      </div>

      {isAdmin && data.governance && data.storage && (
        <div className="grid gap-6 xl:grid-cols-2 xl:items-stretch">
          <OverviewGovernancePanel governance={data.governance} />
          <OverviewStoragePanel
            storage={data.storage}
            downloadsInPeriod={data.summary.downloadsInPeriod}
            recentErrors={data.recentErrors}
            showRulesCta={!data.health.hasActiveExtractionRules}
          />
        </div>
      )}

      <DocumentViewerModal
        open={Boolean(selectedDocId)}
        documentId={selectedDocId}
        onClose={() => setSelectedDocId(null)}
      />
    </PageShell>
  );
}
