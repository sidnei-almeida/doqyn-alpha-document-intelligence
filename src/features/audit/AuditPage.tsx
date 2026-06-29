import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
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

type AuditTab = 'pending' | 'events';

export function AuditPage() {
  const location = useLocation();
  const { user } = useAuth();
  const filterDocId = (location.state as { documentId?: string })?.documentId;
  const [activeTab, setActiveTab] = useState<AuditTab>('pending');
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
    eventsError,
    eventFilters,
    setEventFilters,
    groups,
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
    ],
    [isAdmin, overview.pendingCount],
  );

  if (!isAdmin && !user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Governança"
        title="Auditoria"
        description="Acompanhe aprovações, ações administrativas e histórico de eventos do sistema."
      />

      <AuditSummaryCards
        overview={overview}
        loading={overviewLoading || pendingLoading}
        showPending={isAdmin}
      />

      {filterDocId && (
        <p className="rounded-lg border border-doqyn-border bg-doqyn-surface px-4 py-2.5 text-sm text-doqyn-muted">
          Exibindo eventos do documento{' '}
          <span className="font-mono text-doqyn-text">{filterDocId}</span>
        </p>
      )}

      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={(tabId) => setActiveTab(tabId as AuditTab)}
      />

      {activeTab === 'pending' && (
        <Card className="border-doqyn-border bg-doqyn-surface/60">
          <CardContent className="p-4">
            {!isAdmin ? (
              <AuditEmptyState
                icon={<ShieldAlert className="h-5 w-5" />}
                title="Acesso restrito"
                description="Apenas administradores podem consultar pendências e aprovar solicitações."
              />
            ) : pendingError ? (
              <AuditEmptyState
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

      {activeTab === 'events' && (
        <div className="space-y-4">
          <AuditFilters
            filters={eventFilters}
            onChange={(filters) => setEventFilters({ ...filters, documentId: filterDocId })}
          />

          <div className="flex items-center justify-between text-xs text-doqyn-muted">
            <span>
              {eventsTotal} {eventsTotal === 1 ? 'evento' : 'eventos'}
            </span>
            {eventsError && <span className="text-doqyn-danger">Não foi possível carregar eventos.</span>}
          </div>

          <AuditEventsList
            events={events}
            loading={eventsLoading}
            onOpenDetails={setSelectedEvent}
          />
        </div>
      )}

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
        groups={groups}
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
    </div>
  );
}
