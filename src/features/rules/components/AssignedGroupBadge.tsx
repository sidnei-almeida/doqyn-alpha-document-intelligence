import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Group } from '@/types/rules';
import { GROUP_COLOR_STYLES, getInitials } from '@/utils/rulesHelpers';

interface AssignedGroupBadgeProps {
  group: Group;
  onRemove?: () => void;
}

export function AssignedGroupBadge({ group, onRemove }: AssignedGroupBadgeProps) {
  const styles = GROUP_COLOR_STYLES[group.color];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium',
        styles.badge,
      )}
    >
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
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 rounded p-0.5 text-doqyn-muted transition-colors hover:text-doqyn-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-doqyn-primary"
          aria-label={`Remover ${group.name}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
