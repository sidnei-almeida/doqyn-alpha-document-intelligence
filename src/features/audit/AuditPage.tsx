import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PageShell } from '@/components/layout/PageShell';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { InlineErrorHint } from '@/components/ui/InlineErrorHint';
import { useAuth } from '@/features/auth/useAuth';
import { AuditEmptyState } from './components/AuditEmptyState';
import { AuditEventDetailsDialog } from './components/AuditEventDetailsDialog';
import { AuditEventsList } from './components/AuditEventsList';
import { AuditFilters } from './components/AuditFilters';
import { AuditSummaryStrip } from './components/AuditSummaryStrip';
import { PendingApprovalReviewDialog } from './components/PendingApprovalReviewDialog';
import { PendingApprovalsList } from './components/PendingApprovalsList';
import { RejectApprovalDialog } from './components/RejectApprovalDialog';
import { useAuditCenter } from './hooks/useAuditCenter';
import { type PendingApprovalItem } from './api/pendingApprovalsApi';
import type { AuditEvent } from '@/types/audit';
import type { AuditTabId } from './utils/auditDisplay';
import { useTranslation } from 'react-i18next';

export function AuditPage() {
  const { t } = useTranslation('audit');

  const location = useLocation();
  const { user } = useAuth();
  const filterDocId = (location.state as { documentId?: string })?.documentId;
  const [activeTab, setActiveTab] = useState<AuditTabId>('pending');
  const [reviewItem, setReviewItem] = useState<PendingApprovalItem | null>(null);
  const [rejectItem, setRejectItem] = useState<PendingApprovalItem | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  const {
    isAdmin,
    overview,
    overviewLoading,
    overviewError,
    pendingItems,
    pendingLoading,
    pendingError,
    events,
    eventsTotal,
    eventsLoading,
    eventsFetchingMore,
    eventsError,
    hasMoreEvents,
    loadMoreEvents,
    setEventsTab,
    eventFilters,
    setEventFilters,
    rejectMutation,
    approveDocumentMutation,
  } = useAuditCenter(filterDocId);

  const tabs = useMemo(
    () => [
      {
        id: 'pending',
        label: t('auditPage.tabs.pending'),
        badge: isAdmin ? overview.pendingCount : undefined,
      },
      { id: 'events', label: t('auditPage.tabs.events') },
      { id: 'security', label: t('auditPage.tabs.security') },
      { id: 'all', label: t('auditPage.tabs.all') },
    ],
    [isAdmin, overview.pendingCount, t],
  );

  const showEventFilters =
    activeTab === 'events' || activeTab === 'security' || activeTab === 'all';
  const auditFiltersMode =
    activeTab === 'security' ? 'security' : activeTab === 'all' ? 'overview' : 'full';
  const showEventsPanel = activeTab === 'events' || activeTab === 'security' || activeTab === 'all';

  const handleTabChange = (tabId: string) => {
    const nextTab = tabId as AuditTabId;
    setActiveTab(nextTab);
    if (nextTab === 'security' || nextTab === 'events' || nextTab === 'all') {
      setEventsTab(nextTab);
    }
  };

  if (!isAdmin && !user) {
    return null;
  }

  return (
    <PageShell
      eyebrow={t('auditPage.eyebrow')}
      title={t('auditPage.auditoria')}
      description={t('auditPage.acompanheAprovacoesAcoesAdministrativas')}
      bodyClassName="min-h-0"
    >
      <div className="shrink-0">
        {overviewError ? (
          <InlineErrorHint message={t('auditPage.overviewError')} className="mb-4" />
        ) : null}
        <AuditSummaryStrip
          overview={overview}
          loading={overviewLoading || pendingLoading}
          showPending={isAdmin}
          onSelect={handleTabChange}
        />
      </div>

      {filterDocId && (
        <p className="notice-rule notice-rule--accent shrink-0 py-0.5 text-label text-doqyn-muted">
          {t('auditPage.exibindoEventosDoDocumento')}{' '}
          <span className="font-mono text-caption text-doqyn-text">{filterDocId}</span>
        </p>
      )}

      <div className="shrink-0">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {activeTab === 'pending' && (
          <div className="flex min-h-[360px] flex-1 flex-col">
            {!isAdmin ? (
              <AuditEmptyState
                className="min-h-[320px] flex-1 border-t border-doqyn-border"
                title={t('auditPage.acessoRestrito')}
                description={t('auditPage.apenasAdministradoresPodemConsultar')}
              />
            ) : pendingError ? (
              <AuditEmptyState
                className="min-h-[320px] flex-1 border-t border-doqyn-border"
                title={t('auditPage.naoFoiPossivelCarregar')}
                description={t('auditPage.tenteAtualizarAPagina')}
              />
            ) : (
              <PendingApprovalsList
                items={pendingItems}
                isAdmin={isAdmin}
                loading={pendingLoading}
                onReview={setReviewItem}
                onApprove={(item) => approveDocumentMutation.mutate(item)}
                onReject={setRejectItem}
              />
            )}
          </div>
        )}

        {showEventsPanel && (
          <div className="flex min-h-[360px] flex-col space-y-4">
            {activeTab === 'security' && (
              <p className="notice-rule shrink-0 py-0.5 text-caption text-doqyn-muted">
                {t('auditPage.eventosDeBloqueioRejeicao')}
              </p>
            )}

            {showEventFilters && (
              <AuditFilters
                mode={auditFiltersMode}
                filters={eventFilters}
                onChange={(filters) => setEventFilters({ ...filters, documentId: filterDocId })}
              />
            )}

            <div className="flex items-center justify-between gap-4">
              {eventsError ? (
                <span className="text-caption text-doqyn-danger">
                  {t('auditPage.naoFoiPossivelCarregar2')}
                </span>
              ) : (
                <span />
              )}
              <span className="font-mono text-micro tabular-nums text-doqyn-subtle">
                {t('auditPage.eventsCount', { count: eventsTotal })}
                {events.length < eventsTotal
                  ? ` · ${t('auditPage.showing', { count: events.length })}`
                  : ''}
              </span>
            </div>

            <AuditEventsList
              events={events}
              loading={eventsLoading}
              onOpenDetails={setSelectedEvent}
            />

            {hasMoreEvents && (
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={loadMoreEvents}
                  disabled={eventsFetchingMore}
                >
                  {eventsFetchingMore ? t('auditPage.loadingMore') : t('auditPage.loadMore')}
                </Button>
              </div>
            )}

            {!eventsLoading && events.length > 0 && !hasMoreEvents && (
              <p className="shrink-0 text-center font-mono text-micro uppercase tracking-[0.1em] text-doqyn-subtle">
                {t('auditPage.fimDoHistorico')}
              </p>
            )}
          </div>
        )}
      </div>

      <PendingApprovalReviewDialog
        open={Boolean(reviewItem)}
        item={reviewItem}
        isAdmin={isAdmin}
        saving={rejectMutation.isPending || approveDocumentMutation.isPending}
        onClose={() => setReviewItem(null)}
        onApprove={(item) => {
          setReviewItem(null);
          approveDocumentMutation.mutate(item);
        }}
        onReject={(item) => {
          setReviewItem(null);
          setRejectItem(item);
        }}
      />

      <RejectApprovalDialog
        open={Boolean(rejectItem)}
        item={rejectItem}
        saving={rejectMutation.isPending}
        onClose={() => setRejectItem(null)}
        onConfirm={(item, reason) => {
          rejectMutation.mutate({ item, reason }, { onSuccess: () => setRejectItem(null) });
        }}
      />

      <AuditEventDetailsDialog
        open={Boolean(selectedEvent)}
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </PageShell>
  );
}
