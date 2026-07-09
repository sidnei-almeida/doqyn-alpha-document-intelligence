import { cn, formatDate } from '@/lib/utils';
import type { Document } from '@/types/document';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { StatusPill } from './StatusPill';
import { VersionBadge } from './VersionBadge';

interface DocumentRowProps {
  document: Document;
  isSelected?: boolean;
  onClick?: () => void;
}

export function DocumentRow({ document, isSelected, onClick }: DocumentRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-4 rounded-md border px-4 py-3 text-left transition-colors',
        isSelected
          ? 'border-doqyn-primary/50 bg-doqyn-primary/5'
          : 'border-doqyn-border bg-doqyn-surface hover:bg-doqyn-card',
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-doqyn-card">
        <Icon name="description" size={ICON_SIZE.sm} className="text-doqyn-muted" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-doqyn-text">{document.displayName}</p>
        <p className="text-xs text-doqyn-muted">{document.documentType}</p>
      </div>
      <span className="hidden text-xs text-doqyn-muted sm:block">{document.area}</span>
      <StatusPill status={document.status} />
      <VersionBadge version={document.version} isCurrent />
      <span className="hidden text-xs text-doqyn-muted md:block">
        {formatDate(document.updatedAt)}
      </span>
    </button>
  );
}
