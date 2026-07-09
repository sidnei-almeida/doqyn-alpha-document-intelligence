import { getMemberStatusBadge } from '@/lib/statusSemantics';
import { Badge } from './Badge';

interface MemberStatusBadgeProps {
  status: string;
  className?: string;
}

export function MemberStatusBadge({ status, className }: MemberStatusBadgeProps) {
  const config = getMemberStatusBadge(status);

  return (
    <Badge variant={config.semantic} className={className}>
      {config.label}
    </Badge>
  );
}
