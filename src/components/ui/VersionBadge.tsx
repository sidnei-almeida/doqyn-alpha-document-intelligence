import { Badge } from './Badge';

interface VersionBadgeProps {
  version: number;
  isCurrent?: boolean;
  className?: string;
}

export function VersionBadge({ version, isCurrent, className }: VersionBadgeProps) {
  return (
    <Badge variant={isCurrent ? 'primary' : 'default'} className={className}>
      v{version}
      {isCurrent && ' · atual'}
    </Badge>
  );
}
