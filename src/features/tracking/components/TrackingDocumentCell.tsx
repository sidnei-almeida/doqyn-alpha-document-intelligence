import { cn } from '@/lib/utils';

type TrackingDocumentCellProps = {
  name: string;
  versionLabel?: string;
  className?: string;
};

export function TrackingDocumentCell({ name, versionLabel, className }: TrackingDocumentCellProps) {
  return (
    <div
      className={cn(
        'tracking-document-cell flex min-w-0 max-w-[min(100%,28rem)] items-center gap-2',
        className,
      )}
      title={name}
    >
      <span className="tracking-document-name min-w-0 truncate text-doqyn-text">{name}</span>
      {versionLabel ? (
        <span className="tracking-document-version shrink-0 rounded bg-doqyn-bg/60 px-1.5 py-0.5 text-[10px] font-medium text-doqyn-muted">
          {versionLabel}
        </span>
      ) : null}
    </div>
  );
}
