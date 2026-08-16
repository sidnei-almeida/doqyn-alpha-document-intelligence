import { useEffect, useRef } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
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
  const overlayRef = useRef<HTMLDivElement>(null);

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
        aria-labelledby="unblock-access-title"
        className="w-full max-w-lg rounded-lg border border-doqyn-border bg-doqyn-surface shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-doqyn-border-subtle px-6 py-4">
          <h2 id="unblock-access-title" className="text-lg font-medium">
            Desbloquear acesso à empresa?
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

        <div className="flex justify-end gap-2 border-t border-doqyn-border-subtle px-6 py-4">
          <Button variant="secondary" onClick={onClose} disabled={unblocking}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={unblocking}>
            {unblocking ? 'Desbloqueando…' : 'Desbloquear acesso'}
          </Button>
        </div>
      </div>
    </div>
  );
}
