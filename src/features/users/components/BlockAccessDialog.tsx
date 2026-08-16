import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
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
  const overlayRef = useRef<HTMLDivElement>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      className="modal-overlay-scrim fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === overlayRef.current) onClose();
      }}
    >
      <div
        role="dialog"
        aria-labelledby="block-access-title"
        className="w-full max-w-lg rounded-lg border border-doqyn-border bg-doqyn-surface shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-doqyn-border-subtle px-6 py-4">
          <h2 id="block-access-title" className="text-lg font-medium">
            Bloquear acesso à empresa?
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-doqyn-muted hover:bg-doqyn-surface-hover"
            aria-label="Fechar"
          >
            <Icon name="close" size={ICON_SIZE.xs} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-4 text-sm">
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

          <p className="text-xs text-doqyn-muted">
            As sessões ativas nesta empresa serão revogadas.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-doqyn-border-subtle px-6 py-4">
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
        </div>
      </div>
    </div>
  );
}
