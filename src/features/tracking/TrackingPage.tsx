import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { useMemo } from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/Button';
import { TrackingEventDetailsDrawer } from './components/TrackingEventDetailsDrawer';
import { TrackingEventsTable } from './components/TrackingEventsTable';
import { TrackingFilters } from './components/TrackingFilters';
import { TrackingSummaryStrip } from './components/TrackingSummaryStrip';
import { useDocumentTracking } from './hooks/useDocumentTracking';
import { useTrackingSummary } from './hooks/useTrackingSummary';
import type { DocumentTrackingFilters } from '@/types/document-tracking';

const EMPTY_FILTERS: DocumentTrackingFilters = {
  q: '',
  documentId: '',
  category: 'all',
  severity: '',
  status: '',
  actionGroup: '',
  requestId: '',
  from: '',
  to: '',
  action: '',
  actorUserId: '',
};

function hasActiveTrackingFilters(filters: DocumentTrackingFilters): boolean {
  return Boolean(
    filters.q ||
      filters.documentId ||
      (filters.category && filters.category !== 'all') ||
      filters.severity ||
      filters.status ||
      filters.actionGroup ||
      filters.requestId ||
      filters.from ||
      filters.to ||
      filters.action ||
      filters.actorUserId,
  );
}

export function TrackingPage() {
  const {
    filters,
    setFilters,
    items,
    isLoading,
    isError,
    isFetchingMore,
    hasMore,
    loadMore,
    selectedEvent,
    detailLoading,
    openEvent,
    closeEvent,
    selectedEventId,
  } = useDocumentTracking();

  const summaryQuery = useTrackingSummary({ from: filters.from, to: filters.to });
  const showClear = hasActiveTrackingFilters(filters);
  const listSummary = useMemo(
    () => `${items.length} ${items.length === 1 ? 'evento carregado' : 'eventos carregados'}`,
    [items.length],
  );

  return (
    <PageShell
      eyebrow="Rastreabilidade"
      title="Tracking documental"
      description="Investigue quem acessou, visualizou, baixou ou alterou documentos — com rastreabilidade completa e dados sanitizados."
      actions={
        <div className="flex items-center gap-2 text-doqyn-muted">
          <Icon name="monitoring" size={ICON_SIZE.xs} />
          <span className="text-xs">{listSummary}</span>
        </div>
      }
      bodyClassName="min-h-0"
    >
      <TrackingSummaryStrip summary={summaryQuery.data} loading={summaryQuery.isLoading} />

      <TrackingFilters
        filters={filters}
        onChange={setFilters}
        showClear={showClear}
        onClear={() => setFilters(EMPTY_FILTERS)}
        summary={listSummary}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-doqyn-border bg-doqyn-surface px-6 py-16 text-sm text-doqyn-muted">
            Carregando eventos...
          </div>
        ) : isError ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-doqyn-border bg-doqyn-surface px-6 py-16 text-sm text-doqyn-danger">
            Não foi possível carregar o tracking documental.
          </div>
        ) : (
          <TrackingEventsTable
            items={items}
            onSelect={openEvent}
            stretch
            sparseAction={
              showClear ? (
                <Button type="button" variant="secondary" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
                  Limpar filtros
                </Button>
              ) : undefined
            }
            footer={
              hasMore ? (
                <div className="flex justify-center">
                  <Button variant="secondary" onClick={() => loadMore()} disabled={isFetchingMore}>
                    {isFetchingMore ? 'Carregando...' : 'Carregar mais'}
                  </Button>
                </div>
              ) : undefined
            }
          />
        )}
      </div>

      <TrackingEventDetailsDrawer
        open={Boolean(selectedEventId)}
        event={selectedEvent}
        loading={detailLoading}
        onClose={closeEvent}
        onFilterByUser={(userId) => {
          setFilters({ ...filters, actorUserId: userId });
          closeEvent();
        }}
        onFilterByRequestId={(requestId) => {
          setFilters({ ...filters, requestId });
          closeEvent();
        }}
      />
    </PageShell>
  );
}
