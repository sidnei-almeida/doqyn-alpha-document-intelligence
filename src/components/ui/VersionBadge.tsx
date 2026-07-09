import { Badge } from './Badge';

interface VersionBadgeProps {
  version: number | string;
  isCurrent?: boolean;
  className?: string;
}

export function VersionBadge({ version, isCurrent, className }: VersionBadgeProps) {
  const label = typeof version === 'number' ? `v${version}` : version;
  const display = isCurrent ? `${label} · atual` : label;

  return (
    <Badge variant={isCurrent ? 'info' : 'neutral'} className={className}>
      {display}
    </Badge>
  );
}
