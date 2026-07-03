import { Activity } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { TrackingEventDetailsDrawer } from './components/TrackingEventDetailsDrawer';
import { TrackingEventsTable } from './components/TrackingEventsTable';
import { TrackingFilters } from './components/TrackingFilters';
import { useDocumentTracking } from './hooks/useDocumentTracking';

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

  return (
    <PageShell
      eyebrow="Rastreabilidade"
      title="Tracking documental"
      description="Acompanhe eventos, alterações e movimentações dos documentos da organização."
      actions={
        <div className="flex items-center gap-2 text-doqyn-muted">
          <Activity className="h-4 w-4" />
          <span className="text-xs">{items.length} evento(s)</span>
        </div>
      }
      bodyClassName="min-h-0"
    >
      <Card className="flex min-h-[420px] flex-1 flex-col">
        <CardContent className="flex min-h-0 flex-1 flex-col space-y-4 pt-6">
          <div className="shrink-0">
            <TrackingFilters filters={filters} onChange={setFilters} />
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            {isLoading ? (
              <p className="flex flex-1 items-center justify-center py-8 text-center text-sm text-doqyn-muted">
                Carregando eventos...
              </p>
            ) : isError ? (
              <p className="flex flex-1 items-center justify-center py-8 text-center text-sm text-doqyn-danger">
                Não foi possível carregar o tracking documental.
              </p>
            ) : (
              <>
                <TrackingEventsTable items={items} onSelect={openEvent} />
                {hasMore && (
                  <div className="flex shrink-0 justify-center pt-2">
                    <Button variant="secondary" onClick={() => loadMore()} disabled={isFetchingMore}>
                      {isFetchingMore ? 'Carregando...' : 'Carregar mais'}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <TrackingEventDetailsDrawer
        open={Boolean(selectedEventId)}
        event={selectedEvent}
        loading={detailLoading}
        onClose={closeEvent}
      />
    </PageShell>
  );
}
