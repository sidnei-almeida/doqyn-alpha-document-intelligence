import { TruncatedText } from '@/components/ui/TruncatedText';
import { VersionBadge } from '@/components/ui/VersionBadge';
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
        'tracking-document-cell flex min-w-0 max-w-[min(100%,28rem)] items-center gap-1.5',
        className,
      )}
    >
      <TruncatedText className="tracking-document-name text-sm text-doqyn-text">{name}</TruncatedText>
      {versionLabel ? (
        <VersionBadge version={versionLabel} size="xs" className="tracking-document-version shrink-0" />
      ) : null}
    </div>
  );
}
