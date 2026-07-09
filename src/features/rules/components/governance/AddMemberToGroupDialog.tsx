import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import type { CompanyMember, Group } from '@/types/rules';
import { getInitials } from '@/utils/rulesHelpers';

type AddMemberToGroupDialogProps = {
  open: boolean;
  onClose: () => void;
  groups: Group[];
  members: CompanyMember[];
  preselectedGroupId?: string;
  preselectedMemberId?: string;
  onAddMemberToGroup: (
    groupId: string,
    membershipId: string,
  ) => Promise<'added' | 'duplicate' | 'failed'>;
};

export function AddMemberToGroupDialog({
  open,
  onClose,
  groups,
  members,
  preselectedGroupId,
  preselectedMemberId,
  onAddMemberToGroup,
}: AddMemberToGroupDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [groupId, setGroupId] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const activeMembers = useMemo(
    () => members.filter((member) => member.status === 'active'),
    [members],
  );

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const available = groupId
      ? activeMembers.filter((member) => !member.groupIds.includes(groupId))
      : activeMembers;
    if (!query) return available;
    return available.filter(
      (member) =>
        member.name.toLowerCase().includes(query) || member.email.toLowerCase().includes(query),
    );
  }, [activeMembers, groupId, search]);

  const preselectedMember = useMemo(
    () =>
      preselectedMemberId
        ? activeMembers.find((member) => member.id === preselectedMemberId)
        : undefined,
    [activeMembers, preselectedMemberId],
  );

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedMemberIds([]);
      setGroupId(preselectedGroupId ?? '');
      return;
    }
    setGroupId(preselectedGroupId ?? '');
    setSelectedMemberIds(preselectedMemberId ? [preselectedMemberId] : []);
    dialogRef.current?.focus();
  }, [open, preselectedGroupId, preselectedMemberId]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const toggleMember = (memberId: string) => {
    setSelectedMemberIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId],
    );
  };

  async function handleConfirm() {
    if (!groupId) {
      toast.error('Selecione um grupo documental.');
      return;
    }
    if (selectedMemberIds.length === 0) {
      toast.error('Selecione ao menos um membro.');
      return;
    }

    setSubmitting(true);
    let added = 0;
    let duplicates = 0;
    let failed = 0;

    try {
      for (const memberId of selectedMemberIds) {
        const result = await onAddMemberToGroup(groupId, memberId);
        if (result === 'added') added += 1;
        else if (result === 'duplicate') duplicates += 1;
        else failed += 1;
      }

      if (added > 0) {
        toast.success(
          added === 1 ? 'Membro adicionado ao grupo.' : `${added} membros adicionados ao grupo.`,
        );
      }
      if (duplicates > 0 && added === 0 && failed === 0) {
        toast.info(
          selectedMemberIds.length === 1
            ? 'Este membro já pertence a este grupo.'
            : 'Os membros selecionados já pertencem a este grupo.',
        );
      }
      if (added > 0) onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center modal-overlay-scrim p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={(event) => event.target === overlayRef.current && onClose()}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-member-dialog-title"
        className={cn(
          'governance-detail-dialog flex max-h-[min(88vh,680px)] w-full flex-col',
          'border border-doqyn-border bg-doqyn-surface shadow-2xl',
          'rounded-t-2xl sm:max-w-lg sm:rounded-2xl',
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-doqyn-border px-5 py-4">
          <div>
            <h2 id="add-member-dialog-title" className="text-base font-semibold text-doqyn-text">
              Adicionar membro ao grupo
            </h2>
            <p className="mt-1 text-sm text-doqyn-muted">
              Selecione membros já cadastrados nesta organização para vinculá-los a um grupo
              documental.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-doqyn-muted hover:bg-doqyn-hover hover:text-doqyn-text"
            aria-label="Fechar"
          >
            <Icon name="close" size={ICON_SIZE.xs} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {!preselectedGroupId && (
            <Select
              id="add-member-group"
              label="Grupo documental"
              value={groupId}
              onChange={(event) => setGroupId(event.target.value)}
              options={[
                { value: '', label: 'Selecione um grupo…' },
                ...groups.map((group) => ({ value: group.id, label: group.name })),
              ]}
            />
          )}

          {preselectedGroupId && (
            <div className="rounded-lg border border-doqyn-border bg-doqyn-bg/40 px-3 py-2 text-sm text-doqyn-text">
              Grupo:{' '}
              <span className="font-medium">
                {groups.find((group) => group.id === preselectedGroupId)?.name ?? 'Selecionado'}
              </span>
            </div>
          )}

          {preselectedMember && (
            <div className="rounded-lg border border-doqyn-border bg-doqyn-bg/40 px-3 py-2 text-sm text-doqyn-text">
              Membro: <span className="font-medium">{preselectedMember.name}</span>
            </div>
          )}

          {activeMembers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-doqyn-border px-4 py-8 text-center">
              <p className="text-sm text-doqyn-muted">
                Nenhum membro disponível nesta organização. Cadastre ou aprove usuários na tela
                Usuários antes de adicioná-los a grupos documentais.
              </p>
              <Link
                to="/users"
                className="mt-3 inline-block text-sm font-medium text-doqyn-primary hover:underline"
                onClick={onClose}
              >
                Precisa cadastrar um novo usuário? Acesse Usuários.
              </Link>
            </div>
          ) : filteredMembers.length === 0 && groupId ? (
            <div className="rounded-lg border border-dashed border-doqyn-border px-4 py-8 text-center">
              <p className="text-sm text-doqyn-muted">
                Todos os membros ativos desta organização já pertencem a este grupo documental.
              </p>
            </div>
          ) : (
            <>
              <div className="relative">
                <Icon name="search" size={ICON_SIZE.xs} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-doqyn-muted" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nome ou e-mail…"
                  className="h-9 w-full rounded-lg border border-doqyn-border bg-doqyn-bg pl-9 pr-3 text-sm text-doqyn-text placeholder:text-doqyn-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-doqyn-primary"
                />
              </div>

              <ul className="max-h-64 space-y-1.5 overflow-y-auto">
                {filteredMembers.map((member) => {
                  const checked = selectedMemberIds.includes(member.id);
                  const lockedSelection = Boolean(preselectedMemberId);
                  const alreadyInGroup =
                    Boolean(groupId) && member.groupIds.includes(groupId);
                  return (
                    <li key={member.id}>
                      <label
                        className={cn(
                          'flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors',
                          checked
                            ? 'border-doqyn-primary bg-doqyn-primary-bg/40'
                            : 'border-doqyn-border hover:border-doqyn-border-strong',
                          alreadyInGroup && 'opacity-60',
                          lockedSelection && member.id !== preselectedMemberId && 'opacity-50',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={lockedSelection && member.id !== preselectedMemberId}
                          onChange={() => toggleMember(member.id)}
                          className="h-4 w-4 rounded border-doqyn-border-strong accent-doqyn-action"
                        />
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-doqyn-primary-bg text-xs font-semibold text-doqyn-primary">
                          {getInitials(member.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-doqyn-text">
                            {member.name}
                          </span>
                          <span className="block truncate text-xs text-doqyn-muted">
                            {member.email}
                          </span>
                        </span>
                        {alreadyInGroup && (
                          <span className="text-[10px] text-doqyn-muted">Já no grupo</span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>

              {filteredMembers.length === 0 && (
                <p className="text-center text-sm text-doqyn-muted">
                  Nenhum membro encontrado para esta busca.
                </p>
              )}

              <p className="text-center text-xs text-doqyn-muted">
                <Link
                  to="/users"
                  className="font-medium text-doqyn-primary hover:underline"
                  onClick={onClose}
                >
                  Precisa cadastrar um novo usuário? Acesse Usuários.
                </Link>
              </p>
            </>
          )}
        </div>

        {activeMembers.length > 0 && (
          <div className="flex justify-end gap-2 border-t border-doqyn-border px-5 py-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={submitting || !groupId || selectedMemberIds.length === 0}
              onClick={() => void handleConfirm()}
            >
              Adicionar ao grupo
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
