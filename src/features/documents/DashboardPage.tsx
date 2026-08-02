import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { useNavigate } from 'react-router-dom';
import { PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/useAuth';
import { DocumentViewerModal } from '@/features/documents/viewer';
import { DocumentChatDrawer } from '@/features/documents/components/DocumentChatDrawer';
import { useDashboardOverview } from '@/features/dashboard/hooks/useDashboardOverview';
import { OverviewEnvironmentHealthCard } from '@/features/dashboard/components/OverviewEnvironmentHealthCard';
import { OverviewGovernancePanel } from '@/features/dashboard/components/OverviewGovernancePanel';
import { OverviewHeaderActions } from '@/features/dashboard/components/OverviewHeaderActions';
import { OverviewDistributionPanel } from '@/features/dashboard/components/OverviewDistributionPanel';
import { OverviewQuickAccessPanel } from '@/features/dashboard/components/OverviewQuickAccessPanel';
import { OverviewStoragePanel } from '@/features/dashboard/components/OverviewStoragePanel';
import { HomeActivityPanel } from '@/features/dashboard/components/home/HomeActivityPanel';
import { HomeDocumentPanel } from '@/features/dashboard/components/home/HomeDocumentPanel';
import { HomeRecentFilesTable } from '@/features/dashboard/components/home/HomeRecentFilesTable';
import { HomeStatCard } from '@/features/dashboard/components/home/HomeStatCard';
import { HomeSuggestedCarousel } from '@/features/dashboard/components/home/HomeSuggestedCarousel';
import {
  HomeTipCard,
  HOME_TIP_STORAGE_KEY,
} from '@/features/dashboard/components/home/HomeTipCard';
import { formatStorageBytes } from '@/features/dashboard/utils/buildOverviewMetrics';
import { cn } from '@/lib/utils';
import type { DashboardPeriodKey } from '@/types/dashboard-overview';
import type { DocumentListItem } from '@/types/document-library';

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [period, setPeriod] = useState<DashboardPeriodKey>('30d');
  const [viewerDocId, setViewerDocId] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<DocumentListItem | null>(null);
  const [chatDoc, setChatDoc] = useState<DocumentListItem | null>(null);
  const [tipDismissed, setTipDismissed] = useState(
    () => localStorage.getItem(HOME_TIP_STORAGE_KEY) === 'true',
  );
  const { data, isLoading, isError, refetch, isFetching } = useDashboardOverview(period);

  const openDocument = (doc: DocumentListItem) => {
    if (!doc.permissions?.canPreview) return;
    setViewerDocId(doc.documentId);
  };

  const selectDocument = (doc: DocumentListItem) => {
    setSelectedDoc((current) => (current?.documentId === doc.documentId ? current : doc));
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
  const firstName = user?.name?.trim().split(/\s+/)[0] ?? '';
  const pendingReview = data.summary.documentsAwaitingReview;
  const warningCount = data.health.warnings.length;
  const showTip = isAdmin && !tipDismissed;

  return (
    <PageShell
      eyebrow="Visão geral"
      title={firstName ? `Bem-vindo de volta, ${firstName} 👋` : 'Bem-vindo de volta 👋'}
      description="Veja o que está acontecendo com seus documentos hoje."
      actions={<OverviewHeaderActions period={period} onPeriodChange={setPeriod} />}
      bodyClassName="overview-page w-full gap-6"
    >
      <p
        className={cn(
          'shrink-0 text-xs text-doqyn-subtle',
          isFetching && !isLoading ? 'visible' : 'invisible',
        )}
        aria-live="polite"
      >
        Atualizando métricas…
      </p>

      <div
        className={cn(
          'grid grid-cols-2 gap-3.5',
          showTip ? 'lg:grid-cols-3 xl:grid-cols-5' : 'xl:grid-cols-4',
        )}
      >
        <HomeStatCard
          icon="cloud"
          label="Armazenamento"
          value={data.storage ? formatStorageBytes(data.storage.totalSizeBytes) : '—'}
          caption={data.storage ? `${data.storage.originalFiles} arquivos originais` : undefined}
          actionLabel="Abrir biblioteca"
          onAction={() => navigate('/library')}
        />
        <HomeStatCard
          icon="description"
          label="Documentos"
          value={String(data.summary.totalDocuments)}
          caption={`+${data.summary.documentsUploadedInPeriod} no período`}
          actionLabel="Ver todos"
          onAction={() => navigate('/library')}
        />
        <HomeStatCard
          icon="pending_actions"
          label="Aguardando revisão"
          value={String(pendingReview)}
          caption={`${data.summary.documentsInAnalysis} em análise agora`}
          actionLabel="Ver documentos"
          onAction={() => navigate('/documents')}
          tone={pendingReview > 0 ? 'warn' : 'default'}
        />
        <HomeStatCard
          icon="verified_user"
          label="Saúde do ambiente"
          value={warningCount === 0 ? 'Tudo certo' : `${warningCount} avisos`}
          caption={data.health.analysisReady ? 'Análise de IA operante' : 'Análise indisponível'}
          actionLabel={isAdmin ? 'Ver detalhes' : undefined}
          onAction={isAdmin ? () => navigate('/rules') : undefined}
          tone={warningCount === 0 ? 'ok' : 'warn'}
        />
        {showTip && (
          <HomeTipCard
            title="Configure regras de acesso"
            description="Controle quem vê cada categoria conectando grupos de pessoas."
            actionLabel="Abrir regras"
            onAction={() => navigate('/rules')}
            onDismiss={() => setTipDismissed(true)}
          />
        )}
      </div>

      <div className="grid min-h-0 gap-6 xl:grid-cols-[minmax(0,1fr)_21rem] xl:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <HomeSuggestedCarousel
            documents={data.recentDocuments.slice(0, 8)}
            onOpen={selectDocument}
          />
          {isEmpty ? (
            <div className="rounded-xl border border-doqyn-border-subtle bg-doqyn-surface p-8 text-center">
              <p className="type-h2">Nenhum documento ainda.</p>
              <p className="type-caption mt-1 text-doqyn-subtle">
                Envie o primeiro documento para ver a análise e o histórico por aqui.
              </p>
              <Button type="button" size="sm" className="mt-4" onClick={() => navigate('/upload')}>
                Enviar documento
              </Button>
            </div>
          ) : (
            <HomeRecentFilesTable
              documents={data.recentDocuments}
              selectedDocumentId={selectedDoc?.documentId ?? null}
              onSelect={selectDocument}
              onOpen={openDocument}
              onChat={setChatDoc}
            />
          )}
        </div>
        {selectedDoc ? (
          <HomeDocumentPanel
            doc={selectedDoc}
            onClose={() => setSelectedDoc(null)}
            onOpenViewer={openDocument}
          />
        ) : (
          <HomeActivityPanel events={data.recentTrackingEvents} />
        )}
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
            canManageGovernance={isAdmin}
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
          />
        </div>
      )}

      <DocumentViewerModal
        open={Boolean(viewerDocId)}
        documentId={viewerDocId}
        onClose={() => setViewerDocId(null)}
      />

      <DocumentChatDrawer
        open={Boolean(chatDoc)}
        documentId={chatDoc?.documentId ?? null}
        documentName={chatDoc?.displayName ?? null}
        categoryName={chatDoc?.categoryName ?? null}
        onClose={() => setChatDoc(null)}
      />
    </PageShell>
  );
}
