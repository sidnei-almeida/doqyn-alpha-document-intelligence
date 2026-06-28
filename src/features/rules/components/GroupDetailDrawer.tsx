import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import type { CompanyMember, DocumentCategory, Group } from '@/types/rules';
import type { DocumentAccessPermissions } from '../api/rulesApi';
import { PERMISSION_LABELS, readGroupClassPermissions } from '../utils/groupClassPermissions';

type GroupDetailDrawerProps = {
  open: boolean;
  group: Group | null;
  categories: DocumentCategory[];
  members: CompanyMember[];
  groupMemberIds: string[];
  isAdmin: boolean;
  onClose: () => void;
  onSaveGroup: (groupId: string, input: { name: string; description?: string }) => Promise<void>;
  onDeactivateGroup: (groupId: string) => Promise<void>;
  onAddMember: (groupId: string, membershipId: string) => Promise<void>;
  onRemoveMember: (groupId: string, membershipId: string) => Promise<void>;
  onPermissionChange: (
    groupId: string,
    classId: string,
    permissions: DocumentAccessPermissions,
  ) => Promise<void>;
};

const PERMISSION_KEYS = Object.keys(PERMISSION_LABELS) as Array<keyof DocumentAccessPermissions>;

export function GroupDetailDrawer({
  open,
  group,
  categories,
  members,
  groupMemberIds,
  isAdmin,
  onClose,
  onSaveGroup,
  onDeactivateGroup,
  onAddMember,
  onRemoveMember,
  onPermissionChange,
}: GroupDetailDrawerProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');

  useEffect(() => {
    if (!open || !group) return;
    setName(group.name);
    setDescription(group.description ?? '');
    setSelectedMemberId('');
  }, [group, open]);

  if (!open || !group) return null;

  const activeMembers = members.filter((member) => member.status === 'active');
  const availableMembers = activeMembers.filter((member) => !groupMemberIds.includes(member.id));

  async function handleSaveGroup() {
    if (!group || !name.trim()) return;
    setSaving(true);
    try {
      await onSaveGroup(group.id, { name: name.trim(), description: description.trim() || undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex justify-end bg-black/50"
      onClick={(event) => {
        if (event.target === overlayRef.current) onClose();
      }}
    >
      <aside className="flex h-full w-full max-w-xl flex-col border-l border-doqyn-border bg-doqyn-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-doqyn-border-subtle px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-doqyn-text">{group.name}</h2>
            <p className="text-xs text-doqyn-muted">Grupo · auth-service</p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-doqyn-muted">
              Dados do grupo
            </h3>
            <Input value={name} onChange={(event) => setName(event.target.value)} disabled={!isAdmin} />
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Descrição opcional"
              disabled={!isAdmin}
            />
            {isAdmin && (
              <div className="flex gap-2">
                <Button type="button" onClick={() => void handleSaveGroup()} disabled={saving}>
                  Salvar grupo
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => void onDeactivateGroup(group.id)}
                >
                  Desativar grupo
                </Button>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-doqyn-muted">
              Membros do grupo
            </h3>
            {groupMemberIds.length === 0 ? (
              <p className="text-sm text-doqyn-muted">Nenhum membro neste grupo.</p>
            ) : (
              <ul className="space-y-2">
                {groupMemberIds.map((memberId) => {
                  const member = members.find((item) => item.id === memberId);
                  return (
                    <li
                      key={memberId}
                      className="flex items-center justify-between rounded-md border border-doqyn-border-subtle px-3 py-2 text-sm"
                    >
                      <span>{member?.name ?? member?.email ?? memberId}</span>
                      {isAdmin && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void onRemoveMember(group.id, memberId)}
                        >
                          Remover
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {isAdmin && availableMembers.length > 0 && (
              <div className="flex gap-2">
                <select
                  className="h-9 flex-1 rounded-md border border-doqyn-border bg-doqyn-bg px-3 text-sm"
                  value={selectedMemberId}
                  onChange={(event) => setSelectedMemberId(event.target.value)}
                >
                  <option value="">Adicionar membro...</option>
                  {availableMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name || member.email}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!selectedMemberId}
                  onClick={() => {
                    if (!selectedMemberId) return;
                    void onAddMember(group.id, selectedMemberId);
                    setSelectedMemberId('');
                  }}
                >
                  Adicionar
                </Button>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-doqyn-muted">
              Permissões por classe documental
            </h3>
            <p className="text-xs text-doqyn-muted">
              Permissões documentais persistem no MongoDB do app principal.
            </p>
            {categories.length === 0 ? (
              <p className="text-sm text-doqyn-muted">
                Nenhuma permissão documental configurada. Vincule grupos às classes de documentos.
              </p>
            ) : (
              <div className="space-y-3">
                {categories.map((category) => {
                  const permissions = readGroupClassPermissions(category, group.id);
                  return (
                    <div
                      key={category.id}
                      className="rounded-md border border-doqyn-border-subtle p-3"
                    >
                      <p className="text-sm font-medium text-doqyn-text">{category.name}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {PERMISSION_KEYS.map((key) => (
                          <label
                            key={key}
                            className="inline-flex items-center gap-1.5 rounded-full border border-doqyn-border-subtle px-2 py-1 text-[11px]"
                          >
                            <input
                              type="checkbox"
                              checked={permissions[key]}
                              disabled={!isAdmin}
                              onChange={(event) => {
                                const next = { ...permissions, [key]: event.target.checked };
                                if (key !== 'view' && next[key] && !next.view) {
                                  next.view = true;
                                }
                                void onPermissionChange(group.id, category.id, next);
                              }}
                            />
                            {PERMISSION_LABELS[key]}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}
