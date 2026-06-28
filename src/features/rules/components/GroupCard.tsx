import { useState } from 'react';
import { GripVertical, Trash2 } from 'lucide-react';
import { useConfirm } from '@/components/confirm/useConfirm';
import { buildDeleteGroupConfirm } from '@/components/confirm/confirmMessages';
import { cn } from '@/lib/utils';
import type { Group } from '@/types/rules';
import { GROUP_COLOR_STYLES, getInitials } from '@/utils/rulesHelpers';

interface GroupCardProps {
  group: Group;
  memberCount?: number;
  draggable?: boolean;
  isAdmin?: boolean;
  onDelete?: (groupId: string) => void;
}

export function GroupCard({
  group,
  memberCount = 0,
  draggable = true,
  isAdmin = true,
  onDelete,
}: GroupCardProps) {
  const confirm = useConfirm();
  const [isDragging, setIsDragging] = useState(false);
  const styles = GROUP_COLOR_STYLES[group.color];

  const handleDelete = async () => {
    if (!onDelete) return;
    const ok = await confirm(
      buildDeleteGroupConfirm(group.name, memberCount),
    );
    if (ok) onDelete(group.id);
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (!draggable) return;
    e.dataTransfer.setData('groupId', group.id);
    e.dataTransfer.effectAllowed = 'copy';
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <div
      draggable={draggable}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={cn(
        'rounded-lg border bg-doqyn-surface p-3 transition-colors',
        draggable && 'cursor-grab active:cursor-grabbing',
        styles.border,
        isDragging ? 'opacity-40' : 'opacity-100 hover:border-doqyn-border-strong',
        'border-doqyn-border',
      )}
    >
      <div className="flex items-start gap-2">
        {draggable && (
          <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-doqyn-muted" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                styles.avatar,
              )}
            >
              {getInitials(group.name)}
            </span>
            <span className="truncate text-sm font-medium text-doqyn-text">{group.name}</span>
          </div>
          <p className="mt-1.5 text-xs text-doqyn-muted">
            {memberCount} {memberCount === 1 ? 'membro' : 'membros'}
          </p>
        </div>
        {isAdmin && onDelete && (
          <button
            type="button"
            onClick={() => void handleDelete()}
            className="shrink-0 rounded p-1 text-doqyn-muted transition-colors hover:bg-doqyn-hover hover:text-doqyn-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-doqyn-primary"
            aria-label={`Excluir grupo ${group.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
