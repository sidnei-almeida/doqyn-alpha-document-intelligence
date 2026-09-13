import { useMemo } from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/Button';
import { InlineErrorHint } from '@/components/ui/InlineErrorHint';
import { TrackingEventLogDetail } from './components/TrackingEventLogDetail';
import { TrackingEventsTable } from './components/TrackingEventsTable';
import { TrackingFilters } from './components/TrackingFilters';
import { TrackingSummaryStrip } from './components/TrackingSummaryStrip';
import { useDocumentTracking } from './hooks/useDocumentTracking';
import { useTrackingSummary } from './hooks/useTrackingSummary';
import type { DocumentTrackingFilters } from '@/types/document-tracking';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('tracking');

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
    toggleEvent,
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
      eyebrow={t('trackingPage.eyebrow')}
      title={t('trackingPage.trackingDocumental')}
      description={t('trackingPage.investigueQuemAcessouVisualizou')}
      actions={
        <span className="font-mono text-micro tabular-nums text-doqyn-subtle">{listSummary}</span>
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

      <div className="flex min-h-0 flex-col gap-4">
        {isLoading ? (
          <p className="border-t border-doqyn-border px-3 py-10 text-center text-caption text-doqyn-muted">
            {t('trackingPage.carregandoEventos')}
          </p>
        ) : isError ? (
          <InlineErrorHint message={t('trackingPage.loadError')} />
        ) : (
          <TrackingEventsTable
            items={items}
            expandedId={selectedEventId}
            onToggle={toggleEvent}
            renderExpanded={() => (
              <TrackingEventLogDetail
                event={selectedEvent}
                loading={detailLoading}
                onFilterByUser={(userId) => {
                  setFilters({ ...filters, actorUserId: userId });
                  closeEvent();
                }}
                onFilterByRequestId={(requestId) => {
                  setFilters({ ...filters, requestId });
                  closeEvent();
                }}
              />
            )}
            sparseAction={
              showClear ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setFilters(EMPTY_FILTERS)}
                >
                  {t('trackingPage.limparFiltros')}
                </Button>
              ) : undefined
            }
            footer={
              hasMore ? (
                <div className="flex justify-center">
                  <Button variant="secondary" onClick={() => loadMore()} disabled={isFetchingMore}>
                    {isFetchingMore ? t('trackingPage.loadingMore') : t('trackingPage.loadMore')}
                  </Button>
                </div>
              ) : undefined
            }
          />
        )}
      </div>
    </PageShell>
  );
}
