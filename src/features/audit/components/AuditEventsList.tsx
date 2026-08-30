import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { DataTable } from '@/components/ui/DataTable';
import { formatDateTime } from '@/lib/utils';
import type { AuditEvent } from '@/types/audit';
import { AUDIT_ACTION_LABELS, AUDIT_SEVERITY_LABELS, AUDIT_SOURCE_LABELS } from '@/types/audit';
import { AuditEmptyState } from './AuditEmptyState';
import { SkeletonList } from '@/components/ui/SkeletonList';

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
      <SkeletonList
        className="border-t border-doqyn-border"
        rowClassName="h-[52px] py-0"
        label="Carregando eventos"
      />
    );
  }

  if (events.length === 0) {
    return (
      <AuditEmptyState
        className="border-t border-doqyn-border"
        title="Nenhum evento encontrado"
        description="Ajuste a busca ou aguarde novas ações no sistema."
      />
    );
  }

  return (
    <DataTable
      data={events}
      keyExtractor={(event) => event.id}
      onRowClick={onOpenDetails}
      columns={[
        {
          key: 'createdAt',
          header: 'Data/hora',
          className: 'w-[168px]',
          render: (event) => (
            <span className="whitespace-nowrap font-mono text-micro tabular-nums text-doqyn-subtle">
              {formatDateTime(event.createdAt)}
            </span>
          ),
        },
        {
          key: 'actor',
          header: 'Ator',
          render: (event) => (
            <span className="text-doqyn-text">{event.actorName ?? 'Sistema'}</span>
          ),
        },
        {
          key: 'action',
          header: 'Ação',
          render: (event) => (
            <div className="min-w-0">
              <p className="truncate font-medium text-doqyn-text">
                {AUDIT_ACTION_LABELS[event.action] ?? event.action}
              </p>
              <p className="meta-text truncate">{event.description}</p>
            </div>
          ),
        },
        {
          key: 'entity',
          header: 'Entidade',
          // O id inteiro comia um quarto da linha e ninguém o lê por extenso:
          // o prefixo basta para reconhecer, e o resto abre nos detalhes.
          render: (event) => (
            <span
              className="block max-w-[168px] truncate font-mono text-micro text-doqyn-subtle"
              title={event.documentId ?? event.area ?? undefined}
            >
              {event.documentId ?? event.area ?? '—'}
            </span>
          ),
        },
        {
          key: 'severity',
          header: 'Severidade',
          className: 'w-[132px]',
          render: (event) => (
            <Badge variant={SEVERITY_VARIANTS[event.severity]} dot>
              {AUDIT_SEVERITY_LABELS[event.severity]}
            </Badge>
          ),
        },
        {
          key: 'source',
          header: 'Origem',
          render: (event) => (
            <span className="register-label text-doqyn-subtle">
              {AUDIT_SOURCE_LABELS[event.source] ?? event.source}
            </span>
          ),
        },
        {
          // A linha inteira já abre os detalhes; o glifo fica como pista de que
          // há para onde clicar, não como um botão a mais por linha.
          key: 'details',
          header: '',
          headerClassName: 'w-12 text-right',
          className: 'w-12 text-right',
          render: (event) => (
            <div className="flex justify-end">
              <IconButton
                label="Ver detalhes do evento"
                onClick={(clickEvent) => {
                  clickEvent.stopPropagation();
                  onOpenDetails(event);
                }}
              >
                <Icon name="visibility" size={ICON_SIZE.sm} />
              </IconButton>
            </div>
          ),
        },
      ]}
    />
  );
}
