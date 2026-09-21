import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { DEFAULT_GROUP_COLOR, type GroupColor } from '@shared/groupPalette';
import { GroupPalettePicker } from '../GroupPalettePicker';
import { groupColorVar } from '@/utils/rulesHelpers';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/utils';
import type { DocumentCategory, Group } from '@/types/rules';
import type { DocumentAccessPermissions } from '../../api/rulesApi';
import {
  PERMISSION_LABEL_KEYS,
  readGroupClassPermissions,
} from '../../utils/groupClassPermissions';
import { EMPTY_CONNECTION_PERMISSIONS } from '../../utils/governanceConnections';
import { PERMISSION_HINT_KEYS } from '../../utils/governanceMapUi';
import { GovernancePermissionBadges } from './GovernancePermissionBadges';
import { CategoryIcon } from '../categoryIcons';
import { EmptyHint } from '@/components/ui/EmptyHint';
import {
  fromPermissionState,
  isRequirablePermission,
  toPermissionState,
} from '@shared/governancePermissions';
import { useTranslation } from 'react-i18next';

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
  onSaveGroup: (
    groupId: string,
    input: { name: string; description?: string; color?: string },
  ) => Promise<void>;
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

const PERMISSION_KEYS = Object.keys(PERMISSION_LABEL_KEYS) as Array<
  keyof DocumentAccessPermissions
>;

/** `upload` e `manage` são os nomes persistidos de `update` e `audit` — o verbo é quem decide. */
const DOMAIN_VERB: Record<keyof DocumentAccessPermissions, string> = {
  view: 'view',
  download: 'download',
  upload: 'update',
  share: 'share',
  manage: 'audit',
};

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
  const { t } = useTranslation('rules');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<GroupColor>(DEFAULT_GROUP_COLOR);
  const [permissions, setPermissions] = useState<DocumentAccessPermissions>(
    EMPTY_CONNECTION_PERMISSIONS,
  );
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
    category?.documentGroupIds
      .map((id) => groups.find((item) => item.id === id))
      .filter((item): item is Group => Boolean(item)) ?? [];

  const connectedCategories =
    group && selection?.type === 'group'
      ? categories.filter((item) => item.documentGroupIds.includes(group.id))
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
      setColor(group.color);
    } else if (selection.type === 'connection' && category) {
      if (draftConnectionPermissions) {
        setPermissions(draftConnectionPermissions);
      } else {
        setPermissions(readGroupClassPermissions(category, selection.groupId));
      }
    }
  }, [open, selection, category, group, draftConnectionPermissions]);

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
          color,
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
      ? t('governanceDetailDialog.title.category')
      : selection.type === 'group'
        ? t('governanceDetailDialog.title.group')
        : t('governanceDetailDialog.title.connection');

  // O que a ficha descreve — a mesma linha de contexto dos outros diálogos.
  const detailSubtitle =
    selection.type === 'category'
      ? (category?.name ?? t('governanceDetailDialog.fallback.category'))
      : selection.type === 'group'
        ? (group?.name ?? t('governanceDetailDialog.fallback.group'))
        : category && group
          ? `${category.name} · ${group.name}`
          : t('governanceDetailDialog.fallback.connection');

  const renderActions = () => (
    <div className="governance-detail-dialog__actions">
      {selection.type === 'group' && group && onStartConnectMode && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            onStartConnectMode(group.id);
            onClose();
          }}
        >
          {t('governanceDetailDialog.conectarCategoria')}
        </Button>
      )}
      {selection.type === 'category' && onConfigureExtraction && category && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            onConfigureExtraction(category);
            onClose();
          }}
        >
          {t('governanceDetailDialog.camposDaAnalise')}
        </Button>
      )}
      {(selection.type === 'category' || selection.type === 'group') && (
        <Button
          type="button"
          size="sm"
          disabled={saving || !name.trim()}
          onClick={() => void saveEntity()}
        >
          {t('governanceDetailDialog.salvarAlteracoes')}
        </Button>
      )}
      {selection.type === 'connection' && (
        <>
          <Button type="button" size="sm" disabled={saving} onClick={() => void savePermissions()}>
            {t('governanceDetailDialog.salvarPermissoes')}
          </Button>
          {onDisconnect && category && group && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-doqyn-danger"
              disabled={saving}
              aria-label={t('governanceDetailDialog.disconnectAria', {
                category: category.name,
                group: group.name,
              })}
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
              {t('governanceDetailDialog.desconectar')}
            </Button>
          )}
        </>
      )}
      {selection.type === 'category' && onDeleteCategory && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-doqyn-danger"
          onClick={() => void onDeleteCategory(selection.id)}
        >
          {t('governanceDetailDialog.desativarCategoria')}
        </Button>
      )}
      {selection.type === 'group' && onDeactivateGroup && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-doqyn-danger"
          onClick={() => void onDeactivateGroup(selection.id)}
        >
          {t('governanceDetailDialog.desativarGrupo')}
        </Button>
      )}
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={detailSubtitle}
      dismissOnOverlay={!saving}
      footer={isAdmin ? renderActions() : undefined}
    >
      <div className="flex flex-col gap-5">
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
                  <span className="text-xs font-medium text-doqyn-muted">
                    {t('governanceDetailDialog.nome')}
                  </span>
                  <Input value={name} onChange={(event) => setName(event.target.value)} />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-doqyn-muted">
                    {t('governanceDetailDialog.descricao')}
                  </span>
                  <Textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={3}
                  />
                </label>
              </>
            ) : (
              <p className="text-sm text-doqyn-muted">
                {category.description || t('governanceDetailDialog.noDescription')}
              </p>
            )}
            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-doqyn-muted">
                {t('governanceDetailDialog.gruposComAcesso')}
              </p>
              {connectedGroups.length === 0 ? (
                <EmptyHint bare>{t('governanceDetailDialog.nenhumGrupoConectado')}</EmptyHint>
              ) : (
                <ul className="space-y-2">
                  {connectedGroups.map((item) => {
                    const edgePermissions = readGroupClassPermissions(category, item.id);
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => onSelectConnection?.(category.id, item.id)}
                          className="governance-link-row"
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className="group-dot"
                              style={{ '--swatch': groupColorVar(item.color) } as CSSProperties}
                              aria-hidden
                            />
                            <span className="type-body font-medium text-doqyn-text">
                              {item.name}
                            </span>
                          </span>
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
                <Input
                  variant="rule"
                  label={t('governanceDetailDialog.nome2')}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
                <Textarea
                  variant="rule"
                  label={t('governanceDetailDialog.descricao2')}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                />
                <GroupPalettePicker value={color} onChange={setColor} />
              </>
            ) : (
              <>
                <p className="font-medium text-doqyn-text">{group.name}</p>
                <p className="text-sm text-doqyn-muted">
                  {group.description || t('governanceDetailDialog.noDescription')}
                </p>
              </>
            )}
            <div className="governance-fact">
              <p className="register-label text-doqyn-subtle">
                {t('governanceDetailDialog.pessoasNoGrupo')}
              </p>
              <p className="type-body text-doqyn-text">
                {memberCount} {memberCount === 1 ? 'pessoa' : 'pessoas'} ·{' '}
                <Link to="/users" className="text-doqyn-primary hover:underline">
                  {t('governanceDetailDialog.gerenciarEmUsuarios')}
                </Link>
              </p>
            </div>
            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-doqyn-muted">
                {t('governanceDetailDialog.categoriasConectadas')}
              </p>
              {connectedCategories.length === 0 ? (
                <EmptyHint bare>{t('governanceDetailDialog.nenhumaCategoriaConectada')}</EmptyHint>
              ) : (
                <ul className="space-y-2">
                  {connectedCategories.map((item) => {
                    const edgePermissions = readGroupClassPermissions(item, group.id);
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => onSelectConnection?.(item.id, group.id)}
                          className="governance-link-row"
                        >
                          <span className="type-body font-medium text-doqyn-text">{item.name}</span>
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
                <span className="text-doqyn-muted">{t('governanceDetailDialog.accesses')}</span>
                <span className="rounded-lg bg-doqyn-surface px-3 py-1.5 font-medium text-doqyn-text">
                  {category.name}
                </span>
              </div>
              <div className="mt-3 flex justify-center">
                <GovernancePermissionBadges permissions={permissions} />
              </div>
              {isDraftOnlyConnection && (
                <p className="mt-2 text-center text-[11px] text-doqyn-warning">
                  {t('governanceDetailDialog.conexaoPendenteSalveO')}
                </p>
              )}
            </div>
            <div className="space-y-2">
              {PERMISSION_KEYS.map((key) => {
                const state = toPermissionState(permissions[key]);
                /**
                 * O meio-termo só aparece onde há acesso e o verbo o aceita.
                 *
                 * Mesma regra do popover da Matriz: sem acesso não há o que pedir, e verbo sem
                 * portão mostraria uma porta que tranca sem ter campainha.
                 */
                const offersRequire = state !== 'deny' && isRequirablePermission(DOMAIN_VERB[key]);
                return (
                  <div key={key} className="space-y-1">
                    <Checkbox
                      checked={state !== 'deny'}
                      disabled={!isAdmin}
                      onChange={(event) =>
                        setPermissions((prev) => ({ ...prev, [key]: event.target.checked }))
                      }
                      label={t(PERMISSION_LABEL_KEYS[key])}
                      wrapperClassName={cn(
                        'flex-row-reverse justify-between rounded-lg border border-doqyn-border px-3 py-2',
                        !isAdmin && 'opacity-70',
                      )}
                    />
                    {offersRequire && (
                      <button
                        type="button"
                        className="permission-popover__state ml-1"
                        data-state={state}
                        disabled={!isAdmin}
                        onClick={() =>
                          setPermissions((prev) => ({
                            ...prev,
                            [key]: fromPermissionState(state === 'require' ? 'allow' : 'require'),
                          }))
                        }
                      >
                        {t(`permission.state.${state === 'require' ? 'require' : 'allow'}`)}
                      </button>
                    )}
                    <p className="px-1 text-[10px] text-doqyn-subtle">
                      {t(PERMISSION_HINT_KEYS[key])}
                    </p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
