import { Badge } from './Badge';
import { Tooltip } from './Tooltip';

interface VersionBadgeProps {
  version: number | string;
  isCurrent?: boolean;
  className?: string;
  size?: 'xs' | 'sm' | 'md';
}

function formatVersionLabel(version: number | string): string {
  if (typeof version === 'number') return `v${version}`;
  const trimmed = version.trim();
  if (!trimmed) return trimmed;
  return /^v/i.test(trimmed) ? trimmed : `v${trimmed}`;
}

export function VersionBadge({ version, isCurrent, className, size = 'sm' }: VersionBadgeProps) {
  const label = formatVersionLabel(version);
  const badge = (
    <Badge
      variant={isCurrent ? 'info' : 'neutral'}
      size={size}
      dot={isCurrent}
      className={className}
    >
      {label}
    </Badge>
  );

  if (isCurrent) {
    return <Tooltip label="Versão atual">{badge}</Tooltip>;
  }

  return badge;
}
