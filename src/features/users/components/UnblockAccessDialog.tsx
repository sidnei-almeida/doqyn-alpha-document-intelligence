import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { CompanyMemberDto } from '../api/usersApi';

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
  return (
    <Modal
      open
      onClose={onClose}
      title="Desbloquear acesso à empresa?"
      subtitle={member.email}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={unblocking}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={unblocking}>
            {unblocking ? 'Desbloqueando…' : 'Desbloquear acesso'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-doqyn-muted">
          O usuário voltará a ter acesso a esta empresa. Outras empresas não serão afetadas.
        </p>

        <dl className="grid gap-2 rounded-md border border-doqyn-border bg-doqyn-card p-3 text-xs">
          <div className="flex justify-between gap-4">
            <dt className="text-doqyn-muted">Usuário</dt>
            <dd className="text-right font-medium">{memberName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-doqyn-muted">E-mail</dt>
            <dd className="text-right">{member.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-doqyn-muted">Empresa</dt>
            <dd className="text-right">{tenantDisplayName}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-doqyn-muted">Status atual</dt>
            <dd>
              <Badge variant="danger">Bloqueado</Badge>
            </dd>
          </div>
        </dl>
      </div>
    </Modal>
  );
}
