import { TruncatedText } from '@/components/ui/TruncatedText';
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
    >
      <TruncatedText className="tracking-document-name text-doqyn-text">{name}</TruncatedText>
      {versionLabel ? (
        <span className="tracking-document-version shrink-0 rounded bg-doqyn-bg/60 px-1.5 py-0.5 text-[10px] font-medium text-doqyn-muted">
          {versionLabel}
        </span>
      ) : null}
    </div>
  );
}
