import { getMemberStatusBadge } from '@/lib/statusSemantics';
import { Badge } from './Badge';
import { useTranslation } from 'react-i18next';

interface MemberStatusBadgeProps {
  status: string;
  className?: string;
}

export function MemberStatusBadge({ status, className }: MemberStatusBadgeProps) {
  const { t } = useTranslation('common');
  const config = getMemberStatusBadge(status);

  return (
    <Badge variant={config.semantic} className={className}>
      {t(config.labelKey)}
    </Badge>
  );
}
