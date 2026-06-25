import { Badge } from '@/components/ui/Badge';
import type { MemberStatus } from '@/types/rules';
import { STATUS_LABELS } from '@/utils/rulesHelpers';

const STATUS_VARIANT: Record<MemberStatus, 'success' | 'warning' | 'danger'> = {
  active: 'success',
  pending: 'warning',
  blocked: 'danger',
};

interface MemberStatusBadgeProps {
  status: MemberStatus;
}

export function MemberStatusBadge({ status }: MemberStatusBadgeProps) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABELS[status]}</Badge>;
}
