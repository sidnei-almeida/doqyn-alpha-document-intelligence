import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/utils';
import type { CompanyMember, DocumentCategory, Group } from '@/types/rules';
import type { DocumentAccessPermissions } from '../../api/rulesApi';
import { PERMISSION_LABELS, readGroupClassPermissions } from '../../utils/groupClassPermissions';
import { EMPTY_CONNECTION_PERMISSIONS } from '../../utils/governanceConnections';
import { CategoryIcon } from '../categoryIcons';
import { MemberRoleBadge } from '../MemberRoleBadge';
import { MemberStatusBadge } from '../MemberStatusBadge';

export type GovernanceEntitySelection =
  | { type: 'category'; id: string }
  | { type: 'group'; id: string }
  | { type: 'member'; id: string }
  | { type: 'connection'; categoryId: string; groupId: string };

/** @deprecated use GovernanceEntitySelection */
export type GovernanceSelection = GovernanceEntitySelection;

type GovernanceDetailDialogProps = {
  open: boolean;
  selection: GovernanceEntitySelection | null;
  categories: DocumentCategory[];
  groups: Group[];
  members: CompanyMember[];
  isAdmin: boolean;
  onClose: () => void;
  onSaveCategory: (
    categoryId: string,
    input: { name: string; description?: string },
  ) => Promise<void>;
  onSaveGroup: (groupId: string, input: { name: string; description?: string }) => Promise<void>;
  onDeleteCategory?: (categoryId: string) => Promise<void>;
  onDeactivateGroup?: (groupId: string) => Promise<void>;
  onRemoveMemberFromGroup?: (groupId: string, membershipId: string) => Promise<void>;
  onPermissionChange: (
    groupId: string,
    categoryId: string,
    permissions: DocumentAccessPermissions,
  ) => Promise<void>;
  onConfigureExtraction?: (category: DocumentCategory) => void;
  onStartConnectMode?: (groupId: string) => void;
  onOpenAddMemberModal?: (options: { groupId?: string; memberId?: string }) => void;
};

const PERMISSION_KEYS = Object.keys(PERMISSION_LABELS) as Array<keyof DocumentAccessPermissions>;

export function GovernanceDetailDialog({
  open,
  selection,
  categories,
  groups,
  members,
  isAdmin,
  onClose,
  onSaveCategory,
  onSaveGroup,
  onDeleteCategory,
  onDeactivateGroup,
  onRemoveMemberFromGroup,
  onPermissionChange,
  onConfigureExtraction,
  onStartConnectMode,
  onOpenAddMemberModal,
}: GovernanceDetailDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<DocumentAccessPermissions>(EMPTY_CONNECTION_PERMISSIONS);
  const [saving, setSaving] = useState(false);

  const category =
    selection?.type === 'category'
      ? categories.find((item) => item.id === selection.id)
      : selection?.type === 'connection'
        ? categories.find((item) => item.id === selection.categoryId)
        : null;

  const group =
    selection?.type === 'group'
      ? groups.find((item) => item.id === selection.id)
      : selection?.type === 'connection'
        ? groups.find((item) => item.id === selection.groupId)
        : null;

  const member = selection?.type === 'member' ? members.find((item) => item.id === selection.id) : null;

  const connectedGroups =
    category?.accessGroupIds
      .map((id) => groups.find((item) => item.id === id))
      .filter((item): item is Group => Boolean(item)) ?? [];

  const membersInGroup =
    group && selection?.type === 'group'
      ? members.filter(
          (item) => item.status === 'active' && item.groupIds.includes(group.id),
        )
      : [];

  const connectedCategories =
    group && selection?.type === 'group'
      ? categories.filter((item) => item.accessGroupIds.includes(group.id))
      : [];

  useEffect(() => {
    if (!open || !selection) return;

    if (selection.type === 'category' && category) {
      setName(category.name);
      setDescription(category.description ?? '');
    } else if (selection.type === 'group' && group) {
      setName(group.name);
      setDescription(group.description ?? '');
    } else if (selection.type === 'connection' && category) {
      setPermissions(readGroupClassPermissions(category, selection.groupId));
    }
  }, [open, selection, category, group]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    dialogRef.current?.focus();

    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || !selection) return null;

  async function saveEntity() {
    if (!isAdmin) return;
    setSaving(true);
    try {
      if (selection?.type === 'category') {
        await onSaveCategory(selection.id, {
          name: name.trim(),
          description: description.trim() || undefined,
        });
      }
      if (selection?.type === 'group') {
        await onSaveGroup(selection.id, {
          name: name.trim(),
          description: description.trim() || undefined,
        });
      }
    } finally {
      setSaving(false);
    }
  }

  async function savePermissions() {
    if (!isAdmin || selection?.type !== 'connection') return;
    setSaving(true);
    try {
      await onPermissionChange(selection.groupId, selection.categoryId, permissions);
    } finally {
      setSaving(false);
    }
  }

  const title =
    selection.type === 'category'
      ? 'Categoria documental'
      : selection.type === 'group'
        ? 'Grupo documental'
        : selection.type === 'member'
          ? 'Membro'
          : 'Regra de acesso';

  const titleId = 'governance-detail-dialog-title';

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={(event) => event.target === overlayRef.current && onClose()}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'governance-detail-dialog flex max-h-[min(88vh,720px)] w-full flex-col',
          'border border-doqyn-border bg-doqyn-surface shadow-2xl',
          'rounded-t-2xl sm:max-w-lg sm:rounded-2xl',
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-doqyn-border px-5 py-4">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-doqyn-muted">
              Detalhes
            </p>
            <h2 id={titleId} className="text-base font-semibold text-doqyn-text">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-doqyn-muted transition-colors hover:bg-doqyn-hover hover:text-doqyn-text"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {selection.type === 'category' && category && (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-doqyn-primary-bg">
                  <CategoryIcon icon={category.icon} className="h-5 w-5 text-doqyn-primary" />
                </div>
                <div>
                  <p className="font-medium text-doqyn-text">{category.name}</p>
                  <p className="text-xs text-doqyn-muted">{category.slug}</p>
                </div>
              </div>
              {isAdmin ? (
                <>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-doqyn-muted">Nome</span>
                    <Input value={name} onChange={(event) => setName(event.target.value)} />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-doqyn-muted">Descrição</span>
                    <Textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      rows={3}
                    />
                  </label>
                </>
              ) : (
                <p className="text-sm text-doqyn-muted">{category.description || 'Sem descrição.'}</p>
              )}
              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-doqyn-muted">
                  Grupos com acesso
                </p>
                {connectedGroups.length === 0 ? (
                  <p className="text-sm text-doqyn-muted">Nenhum grupo conectado.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {connectedGroups.map((item) => (
                      <li
                        key={item.id}
                        className="rounded-lg border border-doqyn-border px-3 py-2 text-sm text-doqyn-text"
                      >
                        {item.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          {selection.type === 'group' && group && (
            <>
              {isAdmin ? (
                <>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-doqyn-muted">Nome</span>
                    <Input value={name} onChange={(event) => setName(event.target.value)} />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-doqyn-muted">Descrição</span>
                    <Textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      rows={3}
                    />
                  </label>
                </>
              ) : (
                <>
                  <p className="font-medium text-doqyn-text">{group.name}</p>
                  <p className="text-sm text-doqyn-muted">{group.description || 'Sem descrição.'}</p>
                </>
              )}
              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-doqyn-muted">
                  Membros
                </p>
                {membersInGroup.length === 0 ? (
                  <p className="text-sm text-doqyn-muted">Nenhum membro neste grupo.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {membersInGroup.map((item) => (
                      <li
                        key={item.id}
                        className="rounded-lg border border-doqyn-border px-3 py-2 text-sm text-doqyn-text"
                      >
                        {item.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-doqyn-muted">
                  Categorias conectadas
                </p>
                {connectedCategories.length === 0 ? (
                  <p className="text-sm text-doqyn-muted">Nenhuma categoria conectada.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {connectedCategories.map((item) => (
                      <li
                        key={item.id}
                        className="rounded-lg border border-doqyn-border px-3 py-2 text-sm text-doqyn-text"
                      >
                        {item.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          {selection.type === 'member' && member && (
            <>
              <div>
                <p className="font-medium text-doqyn-text">{member.name}</p>
                <p className="text-sm text-doqyn-muted">{member.email}</p>
                {member.position && <p className="text-xs text-doqyn-muted">{member.position}</p>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <MemberStatusBadge status={member.status} />
                <MemberRoleBadge role={member.role} />
              </div>
              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-doqyn-muted">
                  Grupos documentais
                </p>
                {member.groupIds.length === 0 ? (
                  <p className="text-sm text-doqyn-muted">Nenhum grupo atribuído.</p>
                ) : (
                  <ul className="space-y-2">
                    {member.groupIds.map((groupId) => {
                      const assignedGroup = groups.find((item) => item.id === groupId);
                      if (!assignedGroup) return null;
                      return (
                        <li
                          key={groupId}
                          className="flex items-center justify-between rounded-lg border border-doqyn-border px-3 py-2"
                        >
                          <span className="text-sm text-doqyn-text">{assignedGroup.name}</span>
                          {isAdmin && onRemoveMemberFromGroup && (
                            <button
                              type="button"
                              className="text-xs text-doqyn-muted hover:text-doqyn-danger"
                              onClick={() => void onRemoveMemberFromGroup(groupId, member.id)}
                            >
                              Remover
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}

          {selection.type === 'connection' && category && group && (
            <>
              <div className="rounded-lg border border-doqyn-border bg-doqyn-bg/40 p-3">
                <p className="text-sm text-doqyn-text">
                  <span className="font-medium">{group.name}</span>
                  <span className="text-doqyn-muted"> → </span>
                  <span className="font-medium">{category.name}</span>
                </p>
              </div>
              <div className="space-y-2">
                {PERMISSION_KEYS.map((key) => (
                  <label
                    key={key}
                    className={cn(
                      'flex items-center justify-between rounded-lg border border-doqyn-border px-3 py-2',
                      !isAdmin && 'opacity-70',
                    )}
                  >
                    <span className="text-sm text-doqyn-text">{PERMISSION_LABELS[key]}</span>
                    <input
                      type="checkbox"
                      checked={permissions[key]}
                      disabled={!isAdmin}
                      onChange={(event) =>
                        setPermissions((prev) => ({ ...prev, [key]: event.target.checked }))
                      }
                      className="h-4 w-4 rounded border-doqyn-border-strong accent-doqyn-action"
                    />
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        {isAdmin && (
          <div className="space-y-2 border-t border-doqyn-border px-5 py-4">
            {selection.type === 'group' && group && (
              <>
                {onStartConnectMode && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={() => {
                      onStartConnectMode(group.id);
                      onClose();
                    }}
                  >
                    Conectar categoria
                  </Button>
                )}
                {onOpenAddMemberModal && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={() => {
                      onOpenAddMemberModal({ groupId: group.id });
                      onClose();
                    }}
                  >
                    Adicionar membro ao grupo
                  </Button>
                )}
              </>
            )}
            {selection.type === 'member' && member && onOpenAddMemberModal && (
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => {
                  onOpenAddMemberModal({ memberId: member.id });
                  onClose();
                }}
              >
                Adicionar a grupo
              </Button>
            )}
            {selection.type === 'category' && onConfigureExtraction && category && (
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => {
                  onConfigureExtraction(category);
                  onClose();
                }}
              >
                Campos da análise
              </Button>
            )}
            {(selection.type === 'category' || selection.type === 'group') && (
              <Button
                type="button"
                className="w-full"
                disabled={saving || !name.trim()}
                onClick={() => void saveEntity()}
              >
                Salvar alterações
              </Button>
            )}
            {selection.type === 'connection' && (
              <Button
                type="button"
                className="w-full"
                disabled={saving}
                onClick={() => void savePermissions()}
              >
                Salvar permissões
              </Button>
            )}
            {selection.type === 'category' && onDeleteCategory && (
              <Button
                type="button"
                variant="secondary"
                className="w-full text-doqyn-danger"
                onClick={() => void onDeleteCategory(selection.id)}
              >
                Desativar categoria
              </Button>
            )}
            {selection.type === 'group' && onDeactivateGroup && (
              <Button
                type="button"
                variant="secondary"
                className="w-full text-doqyn-danger"
                onClick={() => void onDeactivateGroup(selection.id)}
              >
                Desativar grupo
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
