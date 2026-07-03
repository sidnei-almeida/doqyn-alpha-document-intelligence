import { Badge } from './Badge';

interface VersionBadgeProps {
  version: number | string;
  isCurrent?: boolean;
  className?: string;
}

export function VersionBadge({ version, isCurrent, className }: VersionBadgeProps) {
  const label = typeof version === 'number' ? `v${version}` : version;
  return (
    <Badge variant={isCurrent ? 'primary' : 'default'} className={className}>
      {label}
      {isCurrent && ' · atual'}
    </Badge>
  );
}
