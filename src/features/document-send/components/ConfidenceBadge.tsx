import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { getConfidenceLevel } from '../utils/documentNaming';

interface ConfidenceBadgeProps {
  score: number;
  className?: string;
}

const LEVEL_CONFIG = {
  high: {
    labelKey: 'confidenceBadge.high',
    className: 'border-doqyn-success-border bg-doqyn-success-bg text-doqyn-success',
  },
  review: {
    labelKey: 'confidenceBadge.review',
    className: 'border-doqyn-warning-border bg-doqyn-warning-bg text-doqyn-warning',
  },
  low: {
    labelKey: 'confidenceBadge.low',
    className: 'border-doqyn-danger-border bg-doqyn-danger-bg text-doqyn-danger',
  },
} as const;

export function ConfidenceBadge({ score, className }: ConfidenceBadgeProps) {
  const { t } = useTranslation('documentSend');
  const level = getConfidenceLevel(score);
  const config = LEVEL_CONFIG[level];

  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium',
        config.className,
        className,
      )}
    >
      {t(config.labelKey)}
    </span>
  );
}
