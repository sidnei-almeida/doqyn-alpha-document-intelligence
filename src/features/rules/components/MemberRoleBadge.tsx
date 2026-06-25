import { Badge } from '@/components/ui/Badge';
import type { UserRole } from '@/types/rules';
import { ROLE_LABELS } from '@/utils/rulesHelpers';

const ROLE_VARIANT: Record<UserRole, 'info' | 'default' | 'primary'> = {
  admin: 'info',
  manager: 'info',
  member: 'default',
  auditor: 'primary',
};

interface MemberRoleBadgeProps {
  role: UserRole;
}

export function MemberRoleBadge({ role }: MemberRoleBadgeProps) {
  return <Badge variant={ROLE_VARIANT[role]}>{ROLE_LABELS[role]}</Badge>;
}
