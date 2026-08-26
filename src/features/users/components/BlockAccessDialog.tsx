import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import type { CompanyMemberDto, MemberStatus } from '../api/usersApi';

const STATUS_LABELS: Record<MemberStatus, string> = {
  active: 'Ativo',
  pending: 'Pendente',
  blocked: 'Bloqueado',
  rejected: 'Rejeitado',
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
  const [reason, setReason] = useState('');

  return (
    <Modal
      open
      onClose={onClose}
      title="Bloquear acesso à empresa?"
      subtitle={member.email}
      size="md"
      // Pode haver motivo digitado: clicar fora não descarta em silêncio.
      dismissOnOverlay={false}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={blocking}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={() => onConfirm(reason.trim() || undefined)}
            disabled={blocking}
          >
            {blocking ? 'Bloqueando…' : 'Bloquear acesso'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-doqyn-muted">
          Este usuário perderá o acesso a esta empresa. A conta dele não será apagada e acessos em
          outras empresas não serão afetados.
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
              <Badge variant={member.status === 'active' ? 'success' : 'warning'}>
                {STATUS_LABELS[member.status]}
              </Badge>
            </dd>
          </div>
        </dl>

        <div>
          <label className="mb-1 block text-xs text-doqyn-muted" htmlFor="block-reason">
            Motivo do bloqueio (opcional)
          </label>
          <Textarea
            id="block-reason"
            value={reason}
            maxLength={300}
            rows={3}
            placeholder="Ex.: acesso suspenso temporariamente"
            onChange={(event) => setReason(event.target.value)}
          />
          <p className="mt-1 text-xs text-doqyn-muted">{reason.length}/300</p>
        </div>

        <p className="text-xs text-doqyn-muted">As sessões ativas nesta empresa serão revogadas.</p>
      </div>
    </Modal>
  );
}
