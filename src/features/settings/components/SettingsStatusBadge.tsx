import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

type SettingsStatusBadgeProps = {
  status: 'ok' | 'pending';
  className?: string;
};

/** Badge de status das configurações — alinhado ao design system (`Badge`). */
export function SettingsStatusBadge({ status, className }: SettingsStatusBadgeProps) {
  if (status === 'ok') {
    return (
      <Badge variant="success" size="xs" className={className}>
        Ativo
      </Badge>
    );
  }

  return (
    <Badge
      variant="neutral"
      size="xs"
      className={cn('border-dashed opacity-90', className)}
    >
      <Icon name="lock" size={12} aria-hidden />
      Em breve
    </Badge>
  );
}
