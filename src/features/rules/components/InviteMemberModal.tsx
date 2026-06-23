import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/utils';
import type { Group, UserRole } from '@/types/rules';
import { GROUP_COLOR_STYLES } from '@/utils/rulesHelpers';
import type { InviteMemberInput } from '../hooks/useRules';

interface InviteMemberModalProps {
  open: boolean;
  groups: Group[];
  onClose: () => void;
  onInvite: (input: InviteMemberInput) => void;
}

export function InviteMemberModal({ open, groups, onClose, onInvite }: InviteMemberModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [position, setPosition] = useState('');
  const [role, setRole] = useState<UserRole>('member');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setName('');
      setEmail('');
      setPosition('');
      setRole('member');
      setSelectedGroupIds([]);
      setMessage('');
    }
  }, [open]);

  if (!open) return null;

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId],
    );
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim().includes('@')) return;

    onInvite({
      name: name.trim(),
      email: email.trim(),
      position: position.trim() || undefined,
      role,
      groupIds: selectedGroupIds,
      message: message.trim() || undefined,
    });
    onClose();
  };

  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-doqyn-border bg-doqyn-surface p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 id="invite-modal-title" className="text-lg font-semibold text-doqyn-text">
            Convidar membro
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-doqyn-muted hover:text-doqyn-text"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="invite-name"
            label="Nome"
            placeholder="Nome completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            id="invite-email"
            label="E-mail corporativo"
            type="email"
            placeholder="nome@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            id="invite-position"
            label="Cargo / Função"
            placeholder="ex: Analista Financeiro"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
          />
          <Select
            id="invite-role"
            label="Perfil"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            options={[
              { value: 'admin', label: 'Administrador' },
              { value: 'member', label: 'Membro' },
              { value: 'auditor', label: 'Auditor' },
            ]}
          />

          <div>
            <span className="mb-2 block text-xs font-medium text-doqyn-muted">Grupos</span>
            <div className="flex flex-wrap gap-2">
              {groups.map((group) => {
                const selected = selectedGroupIds.includes(group.id);
                const styles = GROUP_COLOR_STYLES[group.color];
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className={cn(
                      'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                      selected ? styles.badge : 'border-doqyn-border text-doqyn-muted hover:text-doqyn-text',
                    )}
                  >
                    {group.name}
                  </button>
                );
              })}
            </div>
          </div>

          <Textarea
            id="invite-message"
            label="Mensagem opcional"
            placeholder="Mensagem personalizada no convite..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
          />

          <p className="text-xs text-doqyn-muted">
            O convite ficará pendente até aprovação de um administrador.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim() || !email.includes('@')}>
              Enviar convite
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
