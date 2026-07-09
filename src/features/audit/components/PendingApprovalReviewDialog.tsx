import { useEffect, useRef } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn, formatDate } from '@/lib/utils';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { AccessRequestDetailsPanel } from '@/features/users/components/AccessRequestDetailsPanel';
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

function OrganizationValue({ tenantName, tenantId }: { tenantName?: string; tenantId: string }) {
  const primary = tenantName?.trim() || tenantId;
  const showSecondary = Boolean(tenantName?.trim() && tenantName.trim() !== tenantId);

  return (
    <div className="min-w-0">
      <p className="break-words text-sm font-medium text-doqyn-text">{primary}</p>
      {showSecondary && (
        <TruncatedText as="p" className="mt-0.5 text-[11px] text-doqyn-muted">
          {tenantId}
        </TruncatedText>
      )}
    </div>
  );
}

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

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center modal-overlay-scrim p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === overlayRef.current) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pending-review-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-doqyn-border bg-doqyn-surface shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-doqyn-border px-5 py-4">
          <div className="min-w-0">
            <h2 id="pending-review-title" className="text-base font-semibold text-doqyn-text">
              Revisar solicitação
            </h2>
            <p className="mt-0.5 text-xs text-doqyn-muted">{PENDING_TYPE_LABELS[item.type]}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-doqyn-muted hover:bg-doqyn-hover hover:text-doqyn-text"
            aria-label="Fechar"
          >
            <Icon name="close" size={ICON_SIZE.xs} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4 text-sm">
          <dl className="detail-grid grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-3">
            <div className="detail-item min-w-0">
              <dt className="text-xs text-doqyn-muted">Solicitante</dt>
              <dd className="detail-value mt-0.5 break-words font-medium text-doqyn-text">
                {item.name}
              </dd>
            </div>
            <div className="detail-item min-w-0">
              <dt className="text-xs text-doqyn-muted">E-mail</dt>
              <dd className="detail-value mt-0.5 break-all text-doqyn-text">{item.email}</dd>
            </div>
            <div className="detail-item min-w-0">
              <dt className="text-xs text-doqyn-muted">Organização</dt>
              <dd className="mt-0.5">
                <OrganizationValue tenantName={item.tenantName} tenantId={item.tenantId} />
              </dd>
            </div>
            <div className="detail-item min-w-0">
              <dt className="text-xs text-doqyn-muted">Data</dt>
              <dd className="detail-value mt-0.5 whitespace-nowrap text-doqyn-text">
                {formatDate(item.requestedAt)}
              </dd>
            </div>
          </dl>

          <div>
            <p className="text-xs text-doqyn-muted">Status</p>
            <Badge variant="warning" className="mt-1">
              Pendente
            </Badge>
          </div>

          <AccessRequestDetailsPanel
            member={item.member}
            requestedAccess={item.requestedAccess}
            whatsapp={item.member?.whatsapp}
            consent={item.member?.consent}
            terms={item.member?.terms}
            notificationPreferences={item.member?.notificationPreferences}
            className={cn('rounded-lg border border-doqyn-border bg-doqyn-card/50 p-4')}
          />

          <Link
            to="/users"
            className="inline-flex items-center gap-1 text-xs text-doqyn-primary hover:underline"
          >
            Gerenciar em Usuários
            <Icon name="open_in_new" size={12} />
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
