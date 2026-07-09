import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import type { PendingApprovalItem } from '../api/pendingApprovalsApi';

type RejectApprovalDialogProps = {
  open: boolean;
  item: PendingApprovalItem | null;
  saving?: boolean;
  onClose: () => void;
  onConfirm: (item: PendingApprovalItem, reason: string) => void;
};

export function RejectApprovalDialog({
  open,
  item,
  saving,
  onClose,
  onConfirm,
}: RejectApprovalDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setReason('');
      setError('');
    }
  }, [open, item?.id]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || !item) return null;

  const handleConfirm = () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('Informe o motivo da rejeição.');
      return;
    }
    onConfirm(item, trimmed);
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] flex items-center justify-center modal-overlay-scrim p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === overlayRef.current) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reject-approval-title"
        className="w-full max-w-md rounded-xl border border-doqyn-border bg-doqyn-surface shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-doqyn-border px-5 py-4">
          <div>
            <h2 id="reject-approval-title" className="text-base font-semibold text-doqyn-text">
              Rejeitar solicitação
            </h2>
            <p className="mt-0.5 text-xs text-doqyn-muted">
              {item.name} · {item.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-doqyn-muted hover:bg-doqyn-hover hover:text-doqyn-text"
            aria-label="Fechar"
          >
            <Icon name="close" size={ICON_SIZE.xs} />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <Textarea
            id="reject-reason"
            label="Motivo da rejeição"
            placeholder="Descreva o motivo para o solicitante..."
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              if (error) setError('');
            }}
            rows={4}
            error={error}
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-doqyn-border px-5 py-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={saving}>
            Confirmar rejeição
          </Button>
        </div>
      </div>
    </div>
  );
}
