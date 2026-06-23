import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { AuditEvent } from '@/types/rules';

interface AuditPreviewProps {
  events: AuditEvent[];
  className?: string;
}

export function AuditPreview({ events, className }: AuditPreviewProps) {
  if (events.length === 0) return null;

  return (
    <Card className={cn('border-doqyn-border bg-doqyn-surface', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Auditoria recente</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {events.slice(0, 6).map((event) => (
            <li key={event.id} className="flex items-start justify-between gap-2 text-xs">
              <span className="text-doqyn-text">{event.action}</span>
              <span className="shrink-0 text-doqyn-muted">
                {new Date(event.createdAt).toLocaleDateString('pt-BR')}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
