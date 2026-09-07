import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatDateTime } from '@/lib/utils';
import type { AuditEvent } from '@/types/audit';
import { AUDIT_ACTION_LABELS, AUDIT_SEVERITY_LABELS, AUDIT_SOURCE_LABELS } from '@/types/audit';
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
  if (!open || !event) return null;

  const safeMetadata = sanitizeAuditMetadataForDisplay(event.metadata);

  return (
    <Modal
      open
      onClose={onClose}
      title="Detalhes do evento"
      subtitle={AUDIT_ACTION_LABELS[event.action] ?? event.action}
      size="lg"
      footer={
        <Button type="button" variant="secondary" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-doqyn-muted">Ator</p>
            <p className="text-doqyn-text">{event.actorName ?? 'Sistema'}</p>
          </div>
          <div>
            <p className="text-xs text-doqyn-muted">Data/hora</p>
            <p className="text-doqyn-text">{formatDateTime(event.createdAt)}</p>
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
    </Modal>
  );
}
