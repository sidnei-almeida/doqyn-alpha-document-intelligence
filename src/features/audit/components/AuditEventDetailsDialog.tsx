import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatDateTime } from '@/lib/utils';
import type { AuditEvent } from '@/types/audit';
import { AUDIT_SEVERITY_LABEL_KEYS, AUDIT_SOURCE_LABEL_KEYS } from '@/types/audit';
import { sanitizeAuditMetadataForDisplay } from '../utils/auditDisplay';
import { auditEventDescription, auditEventLabel } from '../utils/auditEventText';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation(['audit', 'auditEvents']);

  if (!open || !event) return null;

  const safeMetadata = sanitizeAuditMetadataForDisplay(event.metadata);

  return (
    <Modal
      open
      onClose={onClose}
      title={t('auditEventDetailsDialog.detalhesDoEvento')}
      subtitle={auditEventLabel(t, event.action, event.action)}
      size="lg"
      footer={
        <Button type="button" variant="secondary" onClick={onClose}>
          {t('auditEventDetailsDialog.fechar')}
        </Button>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-doqyn-muted">{t('auditEventDetailsDialog.ator')}</p>
            <p className="text-doqyn-text">{event.actorName ?? t('systemActor')}</p>
          </div>
          <div>
            <p className="text-xs text-doqyn-muted">{t('auditEventDetailsDialog.dataHora')}</p>
            <p className="text-doqyn-text">{formatDateTime(event.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs text-doqyn-muted">{t('auditEventDetailsDialog.severidade')}</p>
            <Badge variant={SEVERITY_VARIANTS[event.severity]} className="mt-1">
              {t(AUDIT_SEVERITY_LABEL_KEYS[event.severity])}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-doqyn-muted">{t('auditEventDetailsDialog.origem')}</p>
            <p className="text-doqyn-text">{t(AUDIT_SOURCE_LABEL_KEYS[event.source])}</p>
          </div>
          {event.requestId && (
            <div className="col-span-2">
              <p className="text-xs text-doqyn-muted">{t('auditEventDetailsDialog.requestId')}</p>
              <p className="font-mono text-xs text-doqyn-text">{event.requestId}</p>
            </div>
          )}
          {event.documentId && (
            <div className="col-span-2">
              <p className="text-xs text-doqyn-muted">{t('auditEventDetailsDialog.documento')}</p>
              <p className="font-mono text-xs text-doqyn-text">{event.documentId}</p>
            </div>
          )}
        </div>

        <div>
          <p className="text-xs text-doqyn-muted">{t('auditEventDetailsDialog.descricao')}</p>
          <p className="text-doqyn-text">{auditEventDescription(t, event)}</p>
        </div>

        {Object.keys(safeMetadata).length > 0 && (
          <div>
            <p className="mb-2 text-xs text-doqyn-muted">
              {t('auditEventDetailsDialog.metadados')}
            </p>
            <pre className="overflow-x-auto rounded-lg border border-doqyn-border bg-doqyn-card p-3 text-xs text-doqyn-text">
              {JSON.stringify(safeMetadata, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </Modal>
  );
}
