import type { DocumentStatus } from '@/types/document';
import { getDocumentStatusBadge } from '@/lib/statusSemantics';
import { Badge, type BadgeProps } from './Badge';

interface StatusPillProps {
  status: DocumentStatus;
  className?: string;
  dot?: boolean;
  size?: BadgeProps['size'];
}

/** Badge pill de status de governança — compacto e semântico. */
export function StatusPill({ status, className, dot = true, size = 'sm' }: StatusPillProps) {
  const config = getDocumentStatusBadge(status);

  return (
    <Badge
      variant={config.semantic === 'neutral' ? 'default' : config.semantic}
      size={size}
      className={className}
      dot={dot}
    >
      {config.label}
    </Badge>
  );
}

/** Badge de status genérico com semântica nomeada. */
export function StatusBadge({
  semantic,
  children,
  className,
  dot = false,
  size = 'sm',
}: {
  semantic: BadgeProps['variant'];
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
  size?: BadgeProps['size'];
}) {
  return (
    <Badge variant={semantic} size={size} className={className} dot={dot}>
      {children}
    </Badge>
  );
}
