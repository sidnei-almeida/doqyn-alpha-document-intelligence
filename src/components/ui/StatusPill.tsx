import { DOCUMENT_STATUSES } from '@/lib/constants';
import type { DocumentStatus } from '@/types/document';
import { Badge } from './Badge';

interface StatusPillProps {
  status: DocumentStatus;
  className?: string;
}

export function StatusPill({ status, className }: StatusPillProps) {
  const config = DOCUMENT_STATUSES[status];
  if (!config) return <Badge className={className}>{status}</Badge>;

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
