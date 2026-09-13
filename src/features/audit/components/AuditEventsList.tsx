import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { DataTable } from '@/components/ui/DataTable';
import { formatDateTime } from '@/lib/utils';
import type { AuditEvent } from '@/types/audit';
import { AUDIT_SEVERITY_LABEL_KEYS, AUDIT_SOURCE_LABEL_KEYS } from '@/types/audit';
import { auditEventDescription, auditEventLabel } from '../utils/auditEventText';
import { AuditEmptyState } from './AuditEmptyState';
import { SkeletonList } from '@/components/ui/SkeletonList';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation(['audit', 'auditEvents']);

  if (loading) {
    return (
      <SkeletonList
        className="border-t border-doqyn-border"
        rowClassName="h-[52px] py-0"
        label={t('auditEventsList.carregandoEventos')}
      />
    );
  }

  if (events.length === 0) {
    return (
      <AuditEmptyState
        className="border-t border-doqyn-border"
        title={t('auditEventsList.nenhumEventoEncontrado')}
        description={t('auditEventsList.ajusteABuscaOu')}
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
          header: t('auditEventsList.columns.createdAt'),
          className: 'w-[168px]',
          render: (event) => (
            <span className="whitespace-nowrap font-mono text-micro tabular-nums text-doqyn-subtle">
              {formatDateTime(event.createdAt)}
            </span>
          ),
        },
        {
          key: 'actor',
          header: t('auditEventsList.columns.actor'),
          render: (event) => (
            <span className="text-doqyn-text">{event.actorName ?? t('systemActor')}</span>
          ),
        },
        {
          key: 'action',
          header: t('auditEventsList.columns.action'),
          render: (event) => (
            <div className="min-w-0">
              <p className="truncate font-medium text-doqyn-text">
                {auditEventLabel(t, event.action, event.action)}
              </p>
              <p className="meta-text truncate">{auditEventDescription(t, event)}</p>
            </div>
          ),
        },
        {
          key: 'entity',
          header: t('auditEventsList.columns.entity'),
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
          header: t('auditEventsList.columns.severity'),
          className: 'w-[132px]',
          render: (event) => (
            <Badge variant={SEVERITY_VARIANTS[event.severity]} dot>
              {t(AUDIT_SEVERITY_LABEL_KEYS[event.severity])}
            </Badge>
          ),
        },
        {
          key: 'source',
          header: t('auditEventsList.columns.source'),
          render: (event) => (
            <span className="register-label text-doqyn-subtle">
              {AUDIT_SOURCE_LABEL_KEYS[event.source]
                ? t(AUDIT_SOURCE_LABEL_KEYS[event.source])
                : event.source}
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
                label={t('auditEventsList.verDetalhesDoEvento')}
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
