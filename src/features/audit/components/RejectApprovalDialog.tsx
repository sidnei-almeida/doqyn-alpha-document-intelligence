import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import type { PendingApprovalItem } from '../api/pendingApprovalsApi';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('audit');

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
      title={t('rejectApprovalDialog.rejeitarSolicitacao')}
      subtitle={`${item.name} · ${item.email}`}
      size="sm"
      // Há motivo digitado em jogo: clicar fora não pode descartar em silêncio.
      dismissOnOverlay={false}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            {t('rejectApprovalDialog.cancelar')}
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={saving}>
            {t('rejectApprovalDialog.confirmarRejeicao')}
          </Button>
        </>
      }
    >
      <Textarea
        id="reject-reason"
        label={t('rejectApprovalDialog.motivoDaRejeicao')}
        placeholder={t('rejectApprovalDialog.descrevaOMotivoPara')}
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
