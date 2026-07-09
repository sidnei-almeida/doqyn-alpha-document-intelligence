import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/utils';
import type { DocumentCategory, Group } from '@/types/rules';
import type { DocumentAccessPermissions } from '../../api/rulesApi';
import { PERMISSION_LABELS, readGroupClassPermissions } from '../../utils/groupClassPermissions';
import { EMPTY_CONNECTION_PERMISSIONS } from '../../utils/governanceConnections';
import { PERMISSION_HINTS } from '../../utils/governanceMapUi';
import { GovernancePermissionBadges } from './GovernancePermissionBadges';
import { CategoryIcon } from '../categoryIcons';

export type GovernanceEntitySelection =
  | { type: 'category'; id: string }
  | { type: 'group'; id: string }
  | { type: 'connection'; categoryId: string; groupId: string };

/** @deprecated use GovernanceEntitySelection */
export type GovernanceSelection = GovernanceEntitySelection;

type GovernanceDetailDialogProps = {
  open: boolean;
  selection: GovernanceEntitySelection | null;
  categories: DocumentCategory[];
  groups: Group[];
  groupMemberCounts: Record<string, number>;
  isAdmin: boolean;
  onClose: () => void;
  onSaveCategory: (
    categoryId: string,
    input: { name: string; description?: string },
  ) => Promise<void>;
  onSaveGroup: (groupId: string, input: { name: string; description?: string }) => Promise<void>;
  onDeleteCategory?: (categoryId: string) => Promise<void>;
  onDeactivateGroup?: (groupId: string) => Promise<void>;
  onPermissionChange: (
    groupId: string,
    categoryId: string,
    permissions: DocumentAccessPermissions,
  ) => Promise<void>;
  onDraftPermissionChange?: (edgeId: string, permissions: DocumentAccessPermissions) => void;
  isDraftOnlyConnection?: boolean;
  draftConnectionPermissions?: DocumentAccessPermissions | null;
  onDisconnect?: (groupId: string, categoryId: string) => Promise<void>;
  onSelectConnection?: (categoryId: string, groupId: string) => void;
  onConfigureExtraction?: (category: DocumentCategory) => void;
  onStartConnectMode?: (groupId: string) => void;
};

const PERMISSION_KEYS = Object.keys(PERMISSION_LABELS) as Array<keyof DocumentAccessPermissions>;

export function GovernanceDetailDialog({
  open,
  selection,
  categories,
  groups,
  groupMemberCounts,
  isAdmin,
  onClose,
  onSaveCategory,
  onSaveGroup,
  onDeleteCategory,
  onDeactivateGroup,
  onPermissionChange,
  onDraftPermissionChange,
  isDraftOnlyConnection = false,
  draftConnectionPermissions = null,
  onDisconnect,
  onSelectConnection,
  onConfigureExtraction,
  onStartConnectMode,
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

  const connectedGroups =
    category?.accessGroupIds
      .map((id) => groups.find((item) => item.id === id))
      .filter((item): item is Group => Boolean(item)) ?? [];

  const connectedCategories =
    group && selection?.type === 'group'
      ? categories.filter((item) => item.accessGroupIds.includes(group.id))
      : [];

  const memberCount = group ? (groupMemberCounts[group.id] ?? group.memberCount ?? 0) : 0;

  useEffect(() => {
    if (!open || !selection) return;

    if (selection.type === 'category' && category) {
      setName(category.name);
      setDescription(category.description ?? '');
    } else if (selection.type === 'group' && group) {
      setName(group.name);
      setDescription(group.description ?? '');
    } else if (selection.type === 'connection' && category) {
      if (draftConnectionPermissions) {
        setPermissions(draftConnectionPermissions);
      } else {
        setPermissions(readGroupClassPermissions(category, selection.groupId));
      }
    }
  }, [open, selection, category, group, draftConnectionPermissions]);

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
      if (isDraftOnlyConnection && onDraftPermissionChange) {
        onDraftPermissionChange(`${selection.categoryId}:${selection.groupId}`, permissions);
        onClose();
        return;
      }
      await onPermissionChange(selection.groupId, selection.categoryId, permissions);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const title =
    selection.type === 'category'
      ? 'Categoria documental'
      : selection.type === 'group'
        ? 'Grupo documental'
        : 'Regra de acesso';

  const titleId = 'governance-detail-dialog-title';

  return (
    <div
      ref={overlayRef}
      className="viewer-overlay-scrim fixed inset-0 z-[var(--z-modal)] flex items-end justify-center p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
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
            <Icon name="close" size={ICON_SIZE.xs} />
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
                  <ul className="space-y-2">
                    {connectedGroups.map((item) => {
                      const edgePermissions = readGroupClassPermissions(category, item.id);
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => onSelectConnection?.(category.id, item.id)}
                            className="flex w-full flex-col gap-2 rounded-lg border border-doqyn-border bg-doqyn-bg/40 px-3 py-2.5 text-left hover:bg-doqyn-surface-hover"
                          >
                            <span className="text-sm font-medium text-doqyn-text">{item.name}</span>
                            <GovernancePermissionBadges permissions={edgePermissions} />
                          </button>
                        </li>
                      );
                    })}
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
              <div className="rounded-lg border border-doqyn-border bg-doqyn-bg/40 px-3 py-3">
                <p className="text-sm text-doqyn-text">
                  <span className="font-medium">{memberCount}</span>{' '}
                  {memberCount === 1 ? 'membro' : 'membros'}
                </p>
                <p className="mt-1 text-xs text-doqyn-muted">
                  Gerencie membros deste grupo na tela{' '}
                  <Link to="/users" className="font-medium text-doqyn-primary hover:underline">
                    Usuários
                  </Link>
                  .
                </p>
              </div>
              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-doqyn-muted">
                  Categorias conectadas
                </p>
                {connectedCategories.length === 0 ? (
                  <p className="text-sm text-doqyn-muted">Nenhuma categoria conectada.</p>
                ) : (
                  <ul className="space-y-2">
                    {connectedCategories.map((item) => {
                      const edgePermissions = readGroupClassPermissions(item, group.id);
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => onSelectConnection?.(item.id, group.id)}
                            className="flex w-full flex-col gap-2 rounded-lg border border-doqyn-border bg-doqyn-bg/40 px-3 py-2.5 text-left hover:bg-doqyn-surface-hover"
                          >
                            <span className="text-sm font-medium text-doqyn-text">{item.name}</span>
                            <GovernancePermissionBadges permissions={edgePermissions} />
                          </button>
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
              <div className="rounded-xl border border-doqyn-border bg-doqyn-bg/50 p-4">
                <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
                  <span className="rounded-lg bg-doqyn-surface px-3 py-1.5 font-medium text-doqyn-text">
                    {group.name}
                  </span>
                  <span className="text-doqyn-muted">acessa</span>
                  <span className="rounded-lg bg-doqyn-surface px-3 py-1.5 font-medium text-doqyn-text">
                    {category.name}
                  </span>
                </div>
                <div className="mt-3 flex justify-center">
                  <GovernancePermissionBadges permissions={permissions} />
                </div>
                {isDraftOnlyConnection && (
                  <p className="mt-2 text-center text-[11px] text-doqyn-warning">
                    Conexão pendente — salve o mapa para aplicar no servidor.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                {PERMISSION_KEYS.map((key) => (
                  <div key={key} className="space-y-1">
                    <Checkbox
                      checked={permissions[key]}
                      disabled={!isAdmin}
                      onChange={(event) =>
                        setPermissions((prev) => ({ ...prev, [key]: event.target.checked }))
                      }
                      label={PERMISSION_LABELS[key]}
                      wrapperClassName={cn(
                        'flex-row-reverse justify-between rounded-lg border border-doqyn-border px-3 py-2',
                        !isAdmin && 'opacity-70',
                      )}
                    />
                    <p className="px-1 text-[10px] text-doqyn-subtle">{PERMISSION_HINTS[key]}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {isAdmin && (
          <div className="space-y-2 border-t border-doqyn-border px-5 py-4">
            {selection.type === 'group' && group && onStartConnectMode && (
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
              <>
                <Button
                  type="button"
                  className="w-full"
                  disabled={saving}
                  onClick={() => void savePermissions()}
                >
                  Salvar permissões
                </Button>
                {onDisconnect && category && group && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full text-doqyn-danger"
                    disabled={saving}
                    aria-label={`Desconectar categoria ${category.name} do grupo ${group.name}`}
                    onClick={async () => {
                      setSaving(true);
                      try {
                        await onDisconnect(selection.groupId, selection.categoryId);
                        onClose();
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    Desconectar
                  </Button>
                )}
              </>
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
