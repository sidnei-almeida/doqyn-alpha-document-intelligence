import { useRef, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { groupColorVar } from '@/utils/rulesHelpers';
import type { DocumentCategory, Group } from '@/types/rules';
import type { DocumentAccessPermissions } from '../../api/rulesApi';
import { PermissionPopover } from '../access/PermissionPopover';
import { PermissionVerbs, type PermissionVerb } from '../access/PermissionVerbs';

export type GroupTokenProps = {
  group: Group;
  memberCount: number;
  /** Ausente na coluna de grupos: lá a ficha ainda não pertence a nenhuma categoria. */
  category?: DocumentCategory;
  permissions?: DocumentAccessPermissions;
  disabled?: boolean;
  onToggleVerb?: (verb: PermissionVerb, next: boolean) => void;
  onChangePermissions?: (permissions: DocumentAccessPermissions) => Promise<void>;
  onRemove?: () => Promise<void>;
  onOpenGroupDetails?: () => void;
};

/**
 * Ficha de grupo — a peça que se move no quadro.
 *
 * Carrega o que basta para decidir: a cor do grupo, o nome, quantas pessoas ele traz e, quando
 * já está dentro de uma categoria, os três verbos ligados ou desligados.
 */
export function GroupToken({
  group,
  memberCount,
  category,
  permissions,
  disabled = false,
  onToggleVerb,
  onChangePermissions,
  onRemove,
  onOpenGroupDetails,
}: GroupTokenProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const draggableId = category ? `token:${category.id}:${group.id}` : `pool:${group.id}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: draggableId,
    disabled,
    data: { groupId: group.id, fromCategoryId: category?.id ?? null },
  });

  return (
    <>
      <div
        ref={setNodeRef}
        className={cn('group-token', isDragging && 'group-token--dragging')}
        style={{ '--swatch': groupColorVar(group.color) } as React.CSSProperties}
        data-connected={Boolean(category)}
      >
        <button
          ref={anchorRef}
          type="button"
          className="group-token__grip"
          disabled={disabled}
          aria-label={
            category
              ? `${group.name} em ${category.name} — abrir opções, ou arraste para mover`
              : `${group.name} — arraste para conceder acesso`
          }
          onClick={() => {
            if (!category) {
              onOpenGroupDetails?.();
              return;
            }
            setPopoverOpen((prev) => !prev);
          }}
          {...listeners}
          {...attributes}
        >
          <span className="group-dot" aria-hidden />
          <span className="group-token__name">{group.name}</span>
          <span className="group-token__count">{memberCount}</span>
        </button>

        {category && permissions ? (
          <PermissionVerbs permissions={permissions} disabled={disabled} onToggle={onToggleVerb} />
        ) : null}
      </div>

      {category && permissions && onChangePermissions && onRemove ? (
        <PermissionPopover
          anchorRef={anchorRef}
          open={popoverOpen}
          onClose={() => setPopoverOpen(false)}
          group={group}
          memberCount={memberCount}
          categoryName={category.name}
          permissions={permissions}
          onChange={onChangePermissions}
          onRemove={onRemove}
          onOpenGroupDetails={onOpenGroupDetails}
        />
      ) : null}
    </>
  );
}
