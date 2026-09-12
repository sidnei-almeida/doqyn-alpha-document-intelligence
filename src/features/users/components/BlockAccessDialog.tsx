import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import type { CompanyMemberDto, MemberStatus } from '../api/usersApi';
import { useTranslation } from 'react-i18next';

const STATUS_KEYS: Record<MemberStatus, string> = {
  invited: 'common:memberStatus.invited',
  active: 'common:memberStatus.active',
  pending: 'common:memberStatus.pending',
  blocked: 'common:memberStatus.blocked',
  rejected: 'common:memberStatus.rejected',
};

type BlockAccessDialogProps = {
  member: CompanyMemberDto;
  memberName: string;
  tenantDisplayName: string;
  blocking: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
};

export function BlockAccessDialog({
  member,
  memberName,
  tenantDisplayName,
  blocking,
  onClose,
  onConfirm,
}: BlockAccessDialogProps) {
  const { t } = useTranslation('users');

  const [reason, setReason] = useState('');

  return (
    <Modal
      open
      onClose={onClose}
      title={t('blockAccessDialog.bloquearAcessoAEmpresa')}
      subtitle={member.email}
      size="md"
      // Pode haver motivo digitado: clicar fora não descarta em silêncio.
      dismissOnOverlay={false}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={blocking}>
            {t('blockAccessDialog.cancelar')}
          </Button>
          <Button
            variant="danger"
            onClick={() => onConfirm(reason.trim() || undefined)}
            disabled={blocking}
          >
            {blocking ? t('blockAccessDialog.blocking') : t('blockAccessDialog.confirm')}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-doqyn-muted">{t('blockAccessDialog.esteUsuarioPerderaO')}</p>

        <dl className="grid gap-2 rounded-md border border-doqyn-border bg-doqyn-card p-3 text-xs">
          <div className="flex justify-between gap-4">
            <dt className="text-doqyn-muted">{t('blockAccessDialog.usuario')}</dt>
            <dd className="text-right font-medium">{memberName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-doqyn-muted">{t('blockAccessDialog.eMail')}</dt>
            <dd className="text-right">{member.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-doqyn-muted">{t('blockAccessDialog.empresa')}</dt>
            <dd className="text-right">{tenantDisplayName}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-doqyn-muted">{t('blockAccessDialog.statusAtual')}</dt>
            <dd>
              <Badge variant={member.status === 'active' ? 'success' : 'warning'}>
                {t(STATUS_KEYS[member.status])}
              </Badge>
            </dd>
          </div>
        </dl>

        <div>
          <label className="mb-1 block text-xs text-doqyn-muted" htmlFor="block-reason">
            {t('blockAccessDialog.motivoDoBloqueioOpcional')}
          </label>
          <Textarea
            id="block-reason"
            value={reason}
            maxLength={300}
            rows={3}
            placeholder={t('blockAccessDialog.exAcessoSuspensoTemporariamente')}
            onChange={(event) => setReason(event.target.value)}
          />
          <p className="mt-1 text-xs text-doqyn-muted">{reason.length}/300</p>
        </div>

        <p className="text-xs text-doqyn-muted">{t('blockAccessDialog.asSessoesAtivasNesta')}</p>
      </div>
    </Modal>
  );
}
