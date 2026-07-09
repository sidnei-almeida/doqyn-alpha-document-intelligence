import type { DocumentStatus } from '@/types/document';
import { getDocumentStatusBadge } from '@/lib/statusSemantics';
import { Badge, type BadgeProps } from './Badge';

interface StatusPillProps {
  status: DocumentStatus;
  className?: string;
  dot?: boolean;
}

/** Badge pill de status de governança — cor semântica dessaturada, peso 500. */
export function StatusPill({ status, className, dot = false }: StatusPillProps) {
  const config = getDocumentStatusBadge(status);

  return (
    <Badge
      variant={config.semantic === 'neutral' ? 'default' : config.semantic}
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
}: {
  semantic: BadgeProps['variant'];
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <Badge variant={semantic} className={className} dot={dot}>
      {children}
    </Badge>
  );
}
