import { useEffect, useRef } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';
import type { PendingApprovalItem } from '../api/pendingApprovalsApi';
import { PENDING_TYPE_LABELS } from '../api/pendingApprovalsApi';

type PendingApprovalReviewDialogProps = {
  open: boolean;
  item: PendingApprovalItem | null;
  isAdmin: boolean;
  saving?: boolean;
  onClose: () => void;
  onApprove: (item: PendingApprovalItem) => void;
  onReject: (item: PendingApprovalItem) => void;
};

export function PendingApprovalReviewDialog({
  open,
  item,
  isAdmin,
  saving,
  onClose,
  onApprove,
  onReject,
}: PendingApprovalReviewDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || !item) return null;

  const access = item.requestedAccess;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === overlayRef.current) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pending-review-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-doqyn-border bg-doqyn-surface shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-doqyn-border px-5 py-4">
          <div>
            <h2 id="pending-review-title" className="text-base font-semibold text-doqyn-text">
              Revisar solicitação
            </h2>
            <p className="mt-0.5 text-xs text-doqyn-muted">{PENDING_TYPE_LABELS[item.type]}</p>
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
              <p className="text-xs text-doqyn-muted">Solicitante</p>
              <p className="font-medium text-doqyn-text">{item.name}</p>
            </div>
            <div>
              <p className="text-xs text-doqyn-muted">E-mail</p>
              <p className="text-doqyn-text">{item.email}</p>
            </div>
            <div>
              <p className="text-xs text-doqyn-muted">Organização</p>
              <p className="text-doqyn-text">{item.tenantName ?? item.tenantId}</p>
            </div>
            <div>
              <p className="text-xs text-doqyn-muted">Data</p>
              <p className="text-doqyn-text">{formatDate(item.requestedAt)}</p>
            </div>
          </div>

          <div>
            <p className="text-xs text-doqyn-muted">Status</p>
            <Badge variant="warning" className="mt-1">
              Pendente
            </Badge>
          </div>

          {access && (
            <div className="rounded-lg border border-doqyn-border bg-doqyn-card/50 p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-doqyn-muted">
                Detalhes da solicitação
              </p>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                {access.jobTitle && (
                  <>
                    <dt className="text-doqyn-muted">Cargo</dt>
                    <dd className="text-doqyn-text">{access.jobTitle}</dd>
                  </>
                )}
                {access.departmentText && (
                  <>
                    <dt className="text-doqyn-muted">Departamento</dt>
                    <dd className="text-doqyn-text">{access.departmentText}</dd>
                  </>
                )}
                {access.tenantDisplayName && (
                  <>
                    <dt className="text-doqyn-muted">Empresa informada</dt>
                    <dd className="text-doqyn-text">{access.tenantDisplayName}</dd>
                  </>
                )}
                {access.taxIdMasked && (
                  <>
                    <dt className="text-doqyn-muted">Documento</dt>
                    <dd className="text-doqyn-text">{access.taxIdMasked}</dd>
                  </>
                )}
                {access.reason && (
                  <>
                    <dt className="col-span-2 text-doqyn-muted">Motivo</dt>
                    <dd className="col-span-2 text-doqyn-text">{access.reason}</dd>
                  </>
                )}
              </dl>
            </div>
          )}

          <Link
            to="/users"
            className="inline-flex items-center gap-1 text-xs text-doqyn-primary hover:underline"
          >
            Gerenciar em Usuários
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {isAdmin && (
          <div className="flex justify-end gap-2 border-t border-doqyn-border px-5 py-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onReject(item)}
              disabled={saving}
            >
              Rejeitar
            </Button>
            <Button type="button" onClick={() => onApprove(item)} disabled={saving}>
              Aprovar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
