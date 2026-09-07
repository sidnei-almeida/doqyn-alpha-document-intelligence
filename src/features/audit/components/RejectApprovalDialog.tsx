import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
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
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  // Montado entre uma solicitação e outra: sem isto, o motivo escrito para a
  // pessoa anterior reapareceria na próxima.
  useEffect(() => {
    if (!open) return;
    setReason('');
    setError('');
  }, [open, item?.id]);

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
    <Modal
      open
      onClose={onClose}
      title="Rejeitar solicitação"
      subtitle={`${item.name} · ${item.email}`}
      size="sm"
      // Há motivo digitado em jogo: clicar fora não pode descartar em silêncio.
      dismissOnOverlay={false}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={saving}>
            Confirmar rejeição
          </Button>
        </>
      }
    >
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
    </Modal>
  );
}
