import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { CompanyMemberDto } from '../api/usersApi';
import { useTranslation } from 'react-i18next';

type UnblockAccessDialogProps = {
  member: CompanyMemberDto;
  memberName: string;
  tenantDisplayName: string;
  unblocking: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function UnblockAccessDialog({
  member,
  memberName,
  tenantDisplayName,
  unblocking,
  onClose,
  onConfirm,
}: UnblockAccessDialogProps) {
  const { t } = useTranslation('users');

  return (
    <Modal
      open
      onClose={onClose}
      title={t('unblockAccessDialog.desbloquearAcessoAEmpresa')}
      subtitle={member.email}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={unblocking}>
            {t('unblockAccessDialog.cancelar')}
          </Button>
          <Button onClick={onConfirm} disabled={unblocking}>
            {unblocking ? 'Desbloqueando…' : 'Desbloquear acesso'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-doqyn-muted">{t('unblockAccessDialog.oUsuarioVoltaraA')}</p>

        <dl className="grid gap-2 rounded-md border border-doqyn-border bg-doqyn-card p-3 text-xs">
          <div className="flex justify-between gap-4">
            <dt className="text-doqyn-muted">{t('unblockAccessDialog.usuario')}</dt>
            <dd className="text-right font-medium">{memberName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-doqyn-muted">{t('unblockAccessDialog.eMail')}</dt>
            <dd className="text-right">{member.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-doqyn-muted">{t('unblockAccessDialog.empresa')}</dt>
            <dd className="text-right">{tenantDisplayName}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-doqyn-muted">{t('unblockAccessDialog.statusAtual')}</dt>
            <dd>
              <Badge variant="danger">{t('unblockAccessDialog.bloqueado')}</Badge>
            </dd>
          </div>
        </dl>
      </div>
    </Modal>
  );
}
