import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';
import type { DocumentTrackingDetail } from '@/types/document-tracking';
import { formatTrackingAction, sanitizeTrackingMetadata } from '../utils/trackingDisplay';

const SEVERITY_VARIANTS = {
  info: 'info',
  warning: 'warning',
  error: 'danger',
  critical: 'danger',
  debug: 'default',
} as const;

type TrackingEventDetailsDrawerProps = {
  open: boolean;
  event: DocumentTrackingDetail | null;
  loading?: boolean;
  onClose: () => void;
};

export function TrackingEventDetailsDrawer({
  open,
  event,
  loading = false,
  onClose,
}: TrackingEventDetailsDrawerProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (keydownEvent: KeyboardEvent) => {
      if (keydownEvent.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const safeMetadata = event ? sanitizeTrackingMetadata(event.metadata) : {};

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm"
      onClick={(clickEvent) => {
        if (clickEvent.target === overlayRef.current) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex h-full w-full max-w-lg flex-col border-l border-doqyn-border bg-doqyn-surface shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-doqyn-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-doqyn-text">Detalhes do evento</h2>
            <p className="mt-1 text-xs text-doqyn-muted">Tracking documental sanitizado</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fechar">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-sm text-doqyn-muted">Carregando detalhes...</p>
          ) : !event ? (
            <p className="text-sm text-doqyn-muted">Evento não encontrado.</p>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={SEVERITY_VARIANTS[event.severity] ?? 'default'}>
                  {event.severity}
                </Badge>
                <span className="text-doqyn-muted">{formatDate(event.occurredAt)}</span>
              </div>

              <div>
                <p className="text-xs text-doqyn-muted">Ação</p>
                <p className="font-medium text-doqyn-text">{formatTrackingAction(event.action)}</p>
                <p className="mt-1 font-mono text-[11px] text-doqyn-subtle">{event.action}</p>
              </div>

              <div>
                <p className="text-xs text-doqyn-muted">Resumo</p>
                <p className="text-doqyn-text">{event.summary}</p>
              </div>

              <div>
                <p className="text-xs text-doqyn-muted">Ator</p>
                <p className="text-doqyn-text">
                  {event.actor.displayName ?? event.actor.email ?? event.actor.userId}
                </p>
                {event.actor.email && (
                  <p className="text-xs text-doqyn-muted">{event.actor.email}</p>
                )}
              </div>

              <div>
                <p className="text-xs text-doqyn-muted">Documento</p>
                <p className="break-words text-doqyn-text">{event.document.name}</p>
                {event.document.documentId && (
                  <p className="mt-1 font-mono text-[11px] text-doqyn-subtle">
                    {event.document.documentId}
                  </p>
                )}
                {event.document.versionLabel && (
                  <p className="mt-1 text-xs text-doqyn-muted">
                    Versão: {event.document.versionLabel}
                  </p>
                )}
              </div>

              {event.versionId && (
                <div>
                  <p className="text-xs text-doqyn-muted">Versão</p>
                  <p className="font-mono text-xs text-doqyn-text">{event.versionId}</p>
                </div>
              )}

              {event.changes?.length ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-doqyn-muted">
                    Alterações
                  </p>
                  <div className="space-y-3">
                    {event.changes.map((change) => (
                      <div
                        key={change.field}
                        className="rounded-md border border-doqyn-border/60 bg-doqyn-bg/40 p-3"
                      >
                        <p className="font-medium text-doqyn-text">{change.field}</p>
                        <p className="mt-1 text-xs text-doqyn-muted">
                          <span className="text-doqyn-subtle">Antes:</span>{' '}
                          {String(change.before ?? '—')}
                        </p>
                        <p className="text-xs text-doqyn-muted">
                          <span className="text-doqyn-subtle">Depois:</span>{' '}
                          {String(change.after ?? '—')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {(event.requestId || event.durationMs) && (
                <div className="rounded-md border border-doqyn-border/50 bg-doqyn-bg/30 p-3 text-xs">
                  {event.requestId && <p>requestId: {event.requestId}</p>}
                  {typeof event.durationMs === 'number' && <p>duração: {event.durationMs}ms</p>}
                </div>
              )}

              {Object.keys(safeMetadata).length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-doqyn-muted">
                    Metadados
                  </p>
                  <pre className="max-h-48 overflow-auto rounded-md bg-doqyn-bg/50 p-3 text-[11px] text-doqyn-muted">
                    {JSON.stringify(safeMetadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
