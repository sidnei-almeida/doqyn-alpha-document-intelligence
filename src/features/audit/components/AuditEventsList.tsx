import { Eye } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { formatDate } from '@/lib/utils';
import type { AuditEvent } from '@/types/audit';
import {
  AUDIT_ACTION_LABELS,
  AUDIT_SEVERITY_LABELS,
  AUDIT_SOURCE_LABELS,
} from '@/types/audit';
import { AuditEmptyState } from './AuditEmptyState';
import { ScrollText } from 'lucide-react';

const SEVERITY_VARIANTS = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'danger',
  critical: 'danger',
} as const;

type AuditEventsListProps = {
  events: AuditEvent[];
  loading?: boolean;
  onOpenDetails: (event: AuditEvent) => void;
};

export function AuditEventsList({ events, loading, onOpenDetails }: AuditEventsListProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-12 animate-pulse rounded-lg border border-doqyn-border bg-doqyn-card"
          />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <AuditEmptyState
        icon={<ScrollText className="h-5 w-5" />}
        title="Nenhum evento encontrado."
        description="Ajuste a busca ou aguarde novas ações no sistema."
      />
    );
  }

  return (
    <DataTable
      data={events}
      keyExtractor={(event) => event.id}
      columns={[
        {
          key: 'createdAt',
          header: 'Data/hora',
          render: (event) => (
            <span className="whitespace-nowrap text-sm text-doqyn-muted">
              {formatDate(event.createdAt)}
            </span>
          ),
        },
        {
          key: 'actor',
          header: 'Ator',
          render: (event) => (
            <span className="text-sm text-doqyn-text">{event.actorName ?? 'Sistema'}</span>
          ),
        },
        {
          key: 'action',
          header: 'Ação',
          render: (event) => (
            <div>
              <p className="text-sm font-medium text-doqyn-text">
                {AUDIT_ACTION_LABELS[event.action] ?? event.action}
              </p>
              <p className="truncate text-xs text-doqyn-muted">{event.description}</p>
            </div>
          ),
        },
        {
          key: 'entity',
          header: 'Entidade',
          render: (event) => (
            <span className="font-mono text-xs text-doqyn-muted">
              {event.documentId ?? event.area ?? '—'}
            </span>
          ),
        },
        {
          key: 'severity',
          header: 'Severidade',
          render: (event) => (
            <Badge variant={SEVERITY_VARIANTS[event.severity]}>
              {AUDIT_SEVERITY_LABELS[event.severity]}
            </Badge>
          ),
        },
        {
          key: 'source',
          header: 'Origem',
          render: (event) => (
            <span className="text-xs text-doqyn-muted">
              {AUDIT_SOURCE_LABELS[event.source] ?? event.source}
            </span>
          ),
        },
        {
          key: 'details',
          header: '',
          className: 'w-[100px]',
          render: (event) => (
            <Button type="button" size="sm" variant="secondary" onClick={() => onOpenDetails(event)}>
              <Eye className="h-3.5 w-3.5" />
              Detalhes
            </Button>
          ),
        },
      ]}
    />
  );
}
