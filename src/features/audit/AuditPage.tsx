import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { useAuth } from '@/features/auth/useAuth';
import { ApproveApprovalDialog } from './components/ApproveApprovalDialog';
import { AuditEmptyState } from './components/AuditEmptyState';
import { AuditEventDetailsDialog } from './components/AuditEventDetailsDialog';
import { AuditEventsList } from './components/AuditEventsList';
import { AuditFilters } from './components/AuditFilters';
import { AuditSummaryCards } from './components/AuditSummaryCards';
import { PendingApprovalReviewDialog } from './components/PendingApprovalReviewDialog';
import { PendingApprovalsList } from './components/PendingApprovalsList';
import { RejectApprovalDialog } from './components/RejectApprovalDialog';
import { useAuditCenter } from './hooks/useAuditCenter';
import type { PendingApprovalItem } from './api/pendingApprovalsApi';
import type { AuditEvent } from '@/types/audit';
import type { AuditTabId } from './utils/auditDisplay';

export function AuditPage() {
  const location = useLocation();
  const { user } = useAuth();
  const filterDocId = (location.state as { documentId?: string })?.documentId;
  const [activeTab, setActiveTab] = useState<AuditTabId>('pending');
  const [reviewItem, setReviewItem] = useState<PendingApprovalItem | null>(null);
  const [approveItem, setApproveItem] = useState<PendingApprovalItem | null>(null);
  const [rejectItem, setRejectItem] = useState<PendingApprovalItem | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  const {
    isAdmin,
    isDoqynAdmin,
    overview,
    overviewLoading,
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
    accessGroups,
    documentGroups,
    approveMutation,
    rejectMutation,
  } = useAuditCenter(filterDocId);

  const tabs = useMemo(
    () => [
      {
        id: 'pending',
        label: 'Pendências',
        badge: isAdmin ? overview.pendingCount : undefined,
      },
      { id: 'events', label: 'Eventos' },
      { id: 'security', label: 'Segurança' },
      { id: 'all', label: 'Todos' },
    ],
    [isAdmin, overview.pendingCount],
  );

  const showEventFilters = activeTab === 'events';
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
      eyebrow="Governança"
      title="Auditoria"
      description="Acompanhe aprovações, ações administrativas e histórico de eventos do sistema."
      bodyClassName="min-h-0"
    >
      <div className="shrink-0">
        <AuditSummaryCards
          overview={overview}
          loading={overviewLoading || pendingLoading}
          showPending={isAdmin}
        />
      </div>

      {filterDocId && (
        <p className="shrink-0 rounded-lg border border-doqyn-border bg-doqyn-surface px-4 py-2.5 text-sm text-doqyn-muted">
          Exibindo eventos do documento{' '}
          <span className="font-mono text-doqyn-text">{filterDocId}</span>
        </p>
      )}

      <div className="shrink-0">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {activeTab === 'pending' && (
          <Card className="flex min-h-[360px] flex-1 flex-col border-doqyn-border bg-doqyn-surface/60">
            <CardContent className="flex flex-1 flex-col p-4">
              {!isAdmin ? (
                <AuditEmptyState
                  className="min-h-[320px] flex-1"
                  icon={<ShieldAlert className="h-5 w-5" />}
                  title="Acesso restrito"
                  description="Apenas administradores podem consultar pendências e aprovar solicitações."
                />
              ) : pendingError ? (
                <AuditEmptyState
                  className="min-h-[320px] flex-1"
                  icon={<ShieldAlert className="h-5 w-5" />}
                  title="Não foi possível carregar pendências"
                  description="Tente atualizar a página ou verifique sua conexão."
                />
              ) : (
                <PendingApprovalsList
                  items={pendingItems}
                  isAdmin={isAdmin}
                  loading={pendingLoading}
                  onReview={setReviewItem}
                  onApprove={setApproveItem}
                  onReject={setRejectItem}
                />
              )}
            </CardContent>
          </Card>
        )}

        {showEventsPanel && (
          <div className="flex min-h-[360px] flex-1 flex-col space-y-4">
          {activeTab === 'security' && (
            <p className="rounded-lg border border-doqyn-border bg-doqyn-surface px-4 py-2.5 text-xs text-doqyn-muted">
              Eventos de bloqueio, rejeição, permissão negada e ações sensíveis registrados no tenant.
            </p>
          )}

          {showEventFilters && (
            <AuditFilters
              filters={eventFilters}
              onChange={(filters) => setEventFilters({ ...filters, documentId: filterDocId })}
            />
          )}

          <div className="flex items-center justify-between text-xs text-doqyn-muted">
            <span>
              {eventsTotal} {eventsTotal === 1 ? 'evento' : 'eventos'}
              {events.length < eventsTotal ? ` · exibindo ${events.length}` : ''}
            </span>
            {eventsError && (
              <span className="text-doqyn-danger">Não foi possível carregar eventos.</span>
            )}
          </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <AuditEventsList
                events={events}
                loading={eventsLoading}
                onOpenDetails={setSelectedEvent}
              />
            </div>

          {hasMoreEvents && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="secondary"
                onClick={loadMoreEvents}
                disabled={eventsFetchingMore}
              >
                {eventsFetchingMore ? 'Carregando...' : 'Carregar mais'}
              </Button>
            </div>
          )}

          {!eventsLoading && events.length > 0 && !hasMoreEvents && (
            <p className="shrink-0 text-center text-xs text-doqyn-muted">Fim do histórico disponível.</p>
          )}
          </div>
        )}
      </div>

      <PendingApprovalReviewDialog
        open={Boolean(reviewItem)}
        item={reviewItem}
        isAdmin={isAdmin}
        saving={approveMutation.isPending || rejectMutation.isPending}
        onClose={() => setReviewItem(null)}
        onApprove={(item) => {
          setReviewItem(null);
          setApproveItem(item);
        }}
        onReject={(item) => {
          setReviewItem(null);
          setRejectItem(item);
        }}
      />

      <ApproveApprovalDialog
        open={Boolean(approveItem)}
        item={approveItem}
        accessGroups={accessGroups}
        documentGroups={documentGroups}
        saving={approveMutation.isPending}
        canAssignDoqynAdmin={isDoqynAdmin}
        onClose={() => setApproveItem(null)}
        onConfirm={(input) => {
          if (!approveItem) return;
          approveMutation.mutate(
            {
              item: approveItem,
              platformRoles: input.platformRoles,
              accessGroupIds: input.accessGroupIds,
              documentGroupIds: input.documentGroupIds,
            },
            { onSuccess: () => setApproveItem(null) },
          );
        }}
      />

      <RejectApprovalDialog
        open={Boolean(rejectItem)}
        item={rejectItem}
        saving={rejectMutation.isPending}
        onClose={() => setRejectItem(null)}
        onConfirm={(item, reason) => {
          rejectMutation.mutate(
            { item, reason },
            { onSuccess: () => setRejectItem(null) },
          );
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
