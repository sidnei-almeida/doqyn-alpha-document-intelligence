import { useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { AnchoredPopover } from '@/components/ui/popover/AnchoredPopover';
import { dropdownMenuItemClass } from '@/components/ui/dropdownMenuStyles';
import { cn } from '@/lib/utils';
import type { DocumentCategory, Group } from '@/types/rules';
import type { DocumentAccessPermissions } from '../../api/rulesApi';
import { EMPTY_CONNECTION_PERMISSIONS } from '../../utils/governanceConnections';
import { CategoryIcon } from '../categoryIcons';
import {
  countPeopleWhoSee,
  getCategoryGroupPermissions,
  listAvailableGroups,
  listConnectedGroups,
  permissionSummaryLabel,
  type SimulationResult,
} from './accessModel';
import { PermissionPopover } from './PermissionPopover';

const DEFAULT_CATEGORY_COLOR = 'var(--folder-accent-default)';

type GroupChipProps = {
  group: Group;
  memberCount: number;
  categoryName: string;
  permissions: DocumentAccessPermissions;
  disabled: boolean;
  onChange: (permissions: DocumentAccessPermissions) => Promise<void>;
  onOpenGroupDetails?: () => void;
};

function GroupChip({
  group,
  memberCount,
  categoryName,
  permissions,
  disabled,
  onChange,
  onOpenGroupDetails,
}: GroupChipProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'bg-doqyn-surface-2 inline-flex h-[30px] items-center gap-1.5 rounded-full border border-doqyn-border-subtle px-2.5',
          'font-display text-[12.5px] font-medium text-doqyn-text transition-colors',
          disabled ? 'cursor-default' : 'hover:border-doqyn-border',
        )}
      >
        <span className="truncate">{group.name}</span>
        <span className="font-normal text-doqyn-subtle">
          · {permissionSummaryLabel(permissions)}
        </span>
      </button>
      <PermissionPopover
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        group={group}
        memberCount={memberCount}
        categoryName={categoryName}
        permissions={permissions}
        onChange={onChange}
        onRemove={() => onChange(EMPTY_CONNECTION_PERMISSIONS)}
        onOpenGroupDetails={onOpenGroupDetails}
      />
    </>
  );
}

type AddGroupChipProps = {
  availableGroups: Group[];
  onSelect: (groupId: string) => Promise<void>;
};

function AddGroupChip({ availableGroups, onSelect }: AddGroupChipProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const pick = async (groupId: string) => {
    setSaving(true);
    try {
      await onSelect(groupId);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-[30px] items-center gap-1 rounded-full border border-dashed border-doqyn-border px-3 font-display text-[12.5px] font-medium text-doqyn-muted transition-colors hover:bg-doqyn-surface-hover hover:text-doqyn-text"
      >
        <Icon name="add" size={14} />
        Adicionar grupo
      </button>
      <AnchoredPopover
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        placement="bottom-start"
        className="w-60 p-1.5"
        aria-label="Adicionar grupo à categoria"
      >
        {availableGroups.map((group) => (
          <button
            key={group.id}
            type="button"
            disabled={saving}
            className={dropdownMenuItemClass}
            onClick={() => void pick(group.id)}
          >
            <span className="truncate">{group.name}</span>
          </button>
        ))}
      </AnchoredPopover>
    </>
  );
}

type CategoryCardMenuProps = {
  onOpenDetails: () => void;
  onConfigureExtraction?: () => void;
};

function CategoryCardMenu({ onOpenDetails, onConfigureExtraction }: CategoryCardMenuProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <IconButton
        ref={anchorRef}
        type="button"
        label="Ações da categoria"
        onClick={() => setOpen((prev) => !prev)}
      >
        <Icon name="more_vert" size={18} />
      </IconButton>
      <AnchoredPopover
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        placement="bottom-end"
        className="w-56 p-1.5"
        role="menu"
        aria-label="Ações da categoria"
      >
        <button
          type="button"
          className={dropdownMenuItemClass}
          onClick={() => {
            setOpen(false);
            onOpenDetails();
          }}
        >
          <Icon name="tune" size={16} className="mr-2 text-doqyn-muted" />
          Detalhes da categoria
        </button>
        {onConfigureExtraction && (
          <button
            type="button"
            className={dropdownMenuItemClass}
            onClick={() => {
              setOpen(false);
              onConfigureExtraction();
            }}
          >
            <Icon name="auto_awesome" size={16} className="mr-2 text-doqyn-muted" />
            Configurar extração IA
          </button>
        )}
      </AnchoredPopover>
    </>
  );
}

type CategoryAccessCardProps = {
  category: DocumentCategory;
  groups: Group[];
  groupMemberCounts: Record<string, number>;
  isAdmin: boolean;
  simulation?: SimulationResult | null;
  onPermissionChange: (
    groupId: string,
    categoryId: string,
    permissions: DocumentAccessPermissions,
  ) => Promise<void>;
  onOpenCategoryDetails: (categoryId: string) => void;
  onOpenGroupDetails: (groupId: string) => void;
  onConfigureExtraction?: (category: DocumentCategory) => void;
};

/** Card de categoria — grupos conectados como chips, no modelo do "compartilhar" do Drive. */
export function CategoryAccessCard({
  category,
  groups,
  groupMemberCounts,
  isAdmin,
  simulation,
  onPermissionChange,
  onOpenCategoryDetails,
  onOpenGroupDetails,
  onConfigureExtraction,
}: CategoryAccessCardProps) {
  const connected = listConnectedGroups(category, groups);
  const available = listAvailableGroups(category, groups);
  const peopleCount = countPeopleWhoSee(category, groups, groupMemberCounts);
  const color = category.color || DEFAULT_CATEGORY_COLOR;

  return (
    <article
      className={cn(
        'flex flex-col gap-3.5 rounded-xl border border-doqyn-border-subtle bg-doqyn-surface p-4 transition-[opacity,border-color]',
        simulation && !simulation.sees && 'opacity-45',
        simulation?.sees && 'border-doqyn-accent-active',
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg"
          style={{ background: `color-mix(in srgb, ${color} 16%, var(--bg-surface-2))` }}
        >
          <CategoryIcon icon={category.icon} color={color} filled size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="type-h2 truncate text-[15px]">{category.name}</h3>
          <p className="type-caption text-doqyn-muted">
            {connected.length === 0
              ? 'Nenhum grupo conectado'
              : `${connected.length} ${connected.length === 1 ? 'grupo conectado' : 'grupos conectados'}`}
          </p>
        </div>
        {isAdmin && (
          <CategoryCardMenu
            onOpenDetails={() => onOpenCategoryDetails(category.id)}
            onConfigureExtraction={
              onConfigureExtraction ? () => onConfigureExtraction(category) : undefined
            }
          />
        )}
      </div>

      <p className="type-body text-doqyn-muted">
        <strong className="font-medium text-doqyn-text">
          {peopleCount} {peopleCount === 1 ? 'pessoa vê' : 'pessoas veem'}
        </strong>{' '}
        esta categoria hoje{connected.length === 0 ? ' — somente administradores' : ''}.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {connected.map((group) => (
          <GroupChip
            key={group.id}
            group={group}
            memberCount={groupMemberCounts[group.id] ?? group.memberCount ?? 0}
            categoryName={category.name}
            permissions={getCategoryGroupPermissions(category, group.id)}
            disabled={!isAdmin}
            onChange={(permissions) => onPermissionChange(group.id, category.id, permissions)}
            onOpenGroupDetails={() => onOpenGroupDetails(group.id)}
          />
        ))}
        {isAdmin && available.length > 0 && (
          <AddGroupChip
            availableGroups={available}
            onSelect={(groupId) =>
              onPermissionChange(groupId, category.id, {
                view: true,
                download: false,
                upload: false,
                share: false,
                manage: false,
              })
            }
          />
        )}
      </div>

      {simulation && (
        <div
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px]',
            simulation.sees
              ? 'bg-doqyn-success-bg text-doqyn-success'
              : 'bg-doqyn-neutral-bg text-doqyn-muted',
          )}
        >
          <Icon name={simulation.sees ? 'check' : 'block'} size={14} />
          {simulation.reason}
        </div>
      )}
    </article>
  );
}
