import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/utils';
import type { Group } from '@/types/rules';
import { GROUP_COLOR_STYLES, getInitials } from '@/utils/rulesHelpers';
import type { GroupDragData } from '../dnd/types';
import { groupChipId } from '../dnd/types';

interface DraggableGroupChipProps {
  group: Group;
  isAdmin?: boolean;
  showGrip?: boolean;
  onRemove?: () => void;
}

export function DraggableGroupChip({
  group,
  isAdmin = false,
  showGrip = true,
  onRemove,
}: DraggableGroupChipProps) {
  const styles = GROUP_COLOR_STYLES[group.color];

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: groupChipId(group.id),
    data: { type: 'group', groupId: group.id } satisfies GroupDragData,
    disabled: !isAdmin,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <span
      ref={setNodeRef}
      style={style}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium',
        styles.badge,
        isDragging && 'opacity-40',
      )}
    >
      {isAdmin && showGrip && (
        <button
          type="button"
          className="cursor-grab touch-none active:cursor-grabbing"
          {...listeners}
          {...attributes}
          aria-label={`Arrastar grupo ${group.name}`}
        >
          <Icon name="drag_indicator" size={12} className="text-doqyn-muted" aria-hidden />
        </button>
      )}
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
          styles.avatar,
        )}
      >
        {getInitials(group.name)}
      </span>
      {group.name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 rounded p-0.5 text-doqyn-muted hover:text-doqyn-danger"
          aria-label={`Remover ${group.name}`}
        >
          ×
        </button>
      )}
    </span>
  );
}

export function GroupChipOverlay({ group }: { group: Group }) {
  const styles = GROUP_COLOR_STYLES[group.color];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium shadow-lg ring-2 ring-doqyn-primary/40',
        styles.badge,
      )}
    >
      {group.name}
    </span>
  );
}
