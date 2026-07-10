import { Badge } from '@/components/ui/Badge';
import { Tooltip } from '@/components/ui/Tooltip';
import type { DocumentSignatureSummary } from '@/types/document-library';
import {
  normalizeSignatureSummary,
  signatureSummaryBadgeLabel,
  signatureSummaryBadgeVariant,
  signatureSummaryHasActivity,
  signatureSummaryTooltip,
} from '@/features/signature/utils/signatureSummaryDisplay';
import { cn } from '@/lib/utils';

type DocumentSignatureBadgeProps = {
  summary?: DocumentSignatureSummary | null;
  className?: string;
  size?: 'xs' | 'sm' | 'md';
  onClick?: () => void;
};

export function DocumentSignatureBadge({
  summary,
  className,
  size = 'xs',
  onClick,
}: DocumentSignatureBadgeProps) {
  if (!signatureSummaryHasActivity(summary)) return null;

  const normalized = normalizeSignatureSummary(summary);
  if (!normalized) return null;

  const label = signatureSummaryBadgeLabel(normalized);
  if (!label) return null;

  const tooltip = signatureSummaryTooltip(normalized);
  const isInteractive = Boolean(onClick);

  const badge = (
    <Badge
      variant={signatureSummaryBadgeVariant(normalized.status)}
      size={size}
      dot
      className={cn(
        className,
        isInteractive && 'cursor-pointer transition-opacity hover:opacity-90',
      )}
      data-testid="document-signature-badge"
      data-signature-status={normalized.status}
      data-signature-count={normalized.signedCount}
    >
      {label}
    </Badge>
  );

  if (!isInteractive) {
    return tooltip ? <Tooltip label={tooltip}>{badge}</Tooltip> : badge;
  }

  return (
    <Tooltip label={tooltip ?? 'Ver assinaturas'}>
      <button
        type="button"
        className="inline-flex max-w-full border-0 bg-transparent p-0"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onClick?.();
        }}
        data-testid="document-signature-badge-button"
        aria-label={tooltip ?? 'Ver assinaturas'}
      >
        {badge}
      </button>
    </Tooltip>
  );
}
