import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';
import type { AuditEvent } from '@/types/audit';
import {
  AUDIT_ACTION_LABELS,
  AUDIT_SEVERITY_LABELS,
  AUDIT_SOURCE_LABELS,
} from '@/types/audit';
import { sanitizeAuditMetadataForDisplay } from '../utils/auditDisplay';

const SEVERITY_VARIANTS = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'danger',
  critical: 'danger',
} as const;

type AuditEventDetailsDialogProps = {
  open: boolean;
  event: AuditEvent | null;
  onClose: () => void;
};

export function AuditEventDetailsDialog({ open, event, onClose }: AuditEventDetailsDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (keydownEvent: KeyboardEvent) => {
      if (keydownEvent.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || !event) return null;

  const safeMetadata = sanitizeAuditMetadataForDisplay(event.metadata);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(clickEvent) => {
        if (clickEvent.target === overlayRef.current) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-event-details-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-doqyn-border bg-doqyn-surface shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-doqyn-border px-5 py-4">
          <div>
            <h2 id="audit-event-details-title" className="text-base font-semibold text-doqyn-text">
              Detalhes do evento
            </h2>
            <p className="mt-0.5 text-xs text-doqyn-muted">
              {AUDIT_ACTION_LABELS[event.action] ?? event.action}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-doqyn-muted hover:bg-doqyn-hover hover:text-doqyn-text"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-doqyn-muted">Ator</p>
              <p className="text-doqyn-text">{event.actorName ?? 'Sistema'}</p>
            </div>
            <div>
              <p className="text-xs text-doqyn-muted">Data/hora</p>
              <p className="text-doqyn-text">{formatDate(event.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-doqyn-muted">Severidade</p>
              <Badge variant={SEVERITY_VARIANTS[event.severity]} className="mt-1">
                {AUDIT_SEVERITY_LABELS[event.severity]}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-doqyn-muted">Origem</p>
              <p className="text-doqyn-text">{AUDIT_SOURCE_LABELS[event.source]}</p>
            </div>
            {event.requestId && (
              <div className="col-span-2">
                <p className="text-xs text-doqyn-muted">Request ID</p>
                <p className="font-mono text-xs text-doqyn-text">{event.requestId}</p>
              </div>
            )}
            {event.documentId && (
              <div className="col-span-2">
                <p className="text-xs text-doqyn-muted">Documento</p>
                <p className="font-mono text-xs text-doqyn-text">{event.documentId}</p>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs text-doqyn-muted">Descrição</p>
            <p className="text-doqyn-text">{event.description}</p>
          </div>

          {Object.keys(safeMetadata).length > 0 && (
            <div>
              <p className="mb-2 text-xs text-doqyn-muted">Metadados</p>
              <pre className="overflow-x-auto rounded-lg border border-doqyn-border bg-doqyn-card p-3 text-xs text-doqyn-text">
                {JSON.stringify(safeMetadata, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-doqyn-border px-5 py-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
