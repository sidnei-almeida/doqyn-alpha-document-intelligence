import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/utils';
import type { CompanyMember, Group } from '@/types/rules';
import { GROUP_COLOR_STYLES, getInitials } from '@/utils/rulesHelpers';
import type { MemberDragData } from '../dnd/types';
import { MemberRoleBadge } from './MemberRoleBadge';
import { MemberStatusBadge } from './MemberStatusBadge';

interface UserCardProps {
  member: CompanyMember;
  sourceGroupId: string | null;
  groups: Group[];
  isSelected?: boolean;
  isAdmin?: boolean;
  onSelect?: () => void;
  onRemoveFromGroup?: () => void;
  compact?: boolean;
}

export function UserCard({
  member,
  sourceGroupId,
  groups,
  isSelected,
  isAdmin = false,
  onSelect,
  onRemoveFromGroup,
  compact = false,
}: UserCardProps) {
  const canDrag = isAdmin && member.status === 'active';

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `member-${member.id}-${sourceGroupId ?? 'available'}`,
    data: {
      type: 'member',
      memberId: member.id,
      sourceGroupId,
    } satisfies MemberDragData,
    disabled: !canDrag,
  });

  const memberGroups = member.groupIds
    .map((id) => groups.find((g) => g.id === id))
    .filter((g): g is Group => Boolean(g));

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={cn(
        'rounded-lg border bg-doqyn-surface transition-shadow',
        isDragging && 'opacity-40 shadow-lg',
        isSelected ? 'border-doqyn-primary/50 ring-1 ring-doqyn-primary/30' : 'border-doqyn-border',
        onSelect && 'cursor-pointer hover:border-doqyn-border-strong',
      )}
    >
      <div className={cn('flex items-start gap-2', compact ? 'p-2' : 'p-2.5')}>
        {canDrag && (
          <button
            type="button"
            className="mt-0.5 shrink-0 cursor-grab touch-none text-doqyn-muted active:cursor-grabbing"
            {...listeners}
            {...attributes}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Arrastar ${member.name}`}
          >
            <Icon name="drag_indicator" size={14} className="text-doqyn-muted" aria-hidden />
          </button>
        )}
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full bg-doqyn-primary-bg font-semibold text-doqyn-primary',
            compact ? 'h-7 w-7 text-[10px]' : 'h-8 w-8 text-xs',
          )}
        >
          {getInitials(member.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn('truncate font-medium text-doqyn-text', compact ? 'text-xs' : 'text-sm')}>
            {member.name}
          </p>
          <p className="truncate text-[11px] text-doqyn-muted">
            {member.position ?? member.email}
          </p>
          {!compact && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              <MemberStatusBadge status={member.status} />
              <MemberRoleBadge role={member.role} />
            </div>
          )}
          {memberGroups.length > 0 && !sourceGroupId && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {memberGroups.map((g) => {
                const styles = GROUP_COLOR_STYLES[g.color];
                return (
                  <span
                    key={g.id}
                    className={cn('rounded border px-1 py-0.5 text-[9px] font-medium', styles.badge)}
                  >
                    {g.name}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        {onRemoveFromGroup && isAdmin && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveFromGroup();
            }}
            className="shrink-0 text-[10px] text-doqyn-muted hover:text-doqyn-danger"
          >
            Remover
          </button>
        )}
      </div>
    </div>
  );
}

export function UserCardOverlay({ member }: { member: CompanyMember }) {
  return (
    <div className="rounded-lg border border-doqyn-primary/50 bg-doqyn-surface p-2.5 shadow-xl ring-2 ring-doqyn-primary/30">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-doqyn-primary-bg text-xs font-semibold text-doqyn-primary">
          {getInitials(member.name)}
        </div>
        <div>
          <p className="text-sm font-medium text-doqyn-text">{member.name}</p>
          <p className="text-[11px] text-doqyn-muted">{member.position ?? member.email}</p>
        </div>
      </div>
    </div>
  );
}
