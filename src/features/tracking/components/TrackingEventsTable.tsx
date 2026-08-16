import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { IconButton } from '@/components/ui/IconButton';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { VersionBadge } from '@/components/ui/VersionBadge';
import { formatDate } from '@/lib/utils';
import type { DocumentTrackingListItem, TrackingListStatus } from '@/types/document-tracking';
import {
  formatSessionOrigin,
  formatTrackingAction,
  formatTrackingStatus,
} from '../utils/trackingDisplay';
import { TrackingDocumentCell } from './TrackingDocumentCell';

const SEVERITY_VARIANTS = {
  info: 'info',
  warning: 'warning',
  error: 'danger',
  critical: 'danger',
  debug: 'default',
} as const;

const STATUS_VARIANTS: Record<TrackingListStatus, 'success' | 'warning' | 'danger' | 'default'> = {
  success: 'success',
  failed: 'danger',
  denied: 'warning',
  pending: 'default',
};

type TrackingEventsTableProps = {
  items: DocumentTrackingListItem[];
  onSelect: (item: DocumentTrackingListItem) => void;
  stretch?: boolean;
  sparseAction?: ReactNode;
  footer?: ReactNode;
};

export function TrackingEventsTable({
  items,
  onSelect,
  stretch = false,
  sparseAction,
  footer,
}: TrackingEventsTableProps) {
  return (
    <DataTable
      stretch={stretch}
      density="compact"
      className={stretch ? 'flex-1' : undefined}
      data={items}
      keyExtractor={(item) => item.id}
      onRowClick={onSelect}
      emptyMessage="Nenhum evento documental encontrado para os filtros selecionados."
      emptyDescription="Ajuste os filtros ou amplie o período para ver mais atividade."
      emptyAction={sparseAction}
      sparseMessage="Nenhum outro evento para os filtros atuais"
      sparseDescription="Tente ampliar o período ou remover filtros para ver mais registros."
      sparseAction={sparseAction}
      footer={footer}
      columns={[
        {
          key: 'occurredAt',
          header: 'Data/hora',
          render: (item) => (
            <span className="whitespace-nowrap text-xs tabular-nums text-doqyn-muted">
              {formatDate(item.occurredAt)}
            </span>
          ),
        },
        {
          key: 'action',
          header: 'Ação',
          render: (item) => (
            <div className="min-w-[140px] space-y-0.5 leading-tight">
              <p className="text-sm font-medium text-doqyn-text">{item.summary}</p>
              <p className="text-[11px] text-doqyn-subtle">{formatTrackingAction(item.action)}</p>
            </div>
          ),
        },
        {
          key: 'document',
          header: 'Documento',
          render: (item) => (
            <TrackingDocumentCell
              name={item.document.name}
              versionLabel={item.document.versionLabel}
              documentId={item.document.documentId ?? undefined}
            />
          ),
        },
        {
          key: 'version',
          header: 'Versão',
          render: (item) => {
            const label =
              item.document.versionLabel ?? (item.versionId ? item.versionId.slice(0, 8) : null);
            return label ? <VersionBadge version={label} size="xs" /> : <span className="text-[11px] text-doqyn-muted">—</span>;
          },
        },
        {
          key: 'actor',
          header: 'Usuário',
          render: (item) => (
            <span className="text-xs text-doqyn-muted">
              {item.actor.displayName ?? item.actor.email ?? item.actor.userId}
            </span>
          ),
        },
        {
          key: 'session',
          header: 'Sessão',
          render: (item) => (
            <TruncatedText className="font-mono text-[11px] text-doqyn-subtle">
              {formatSessionOrigin(item.sessionHash)}
            </TruncatedText>
          ),
        },
        {
          key: 'status',
          header: 'Resultado',
          render: (item) =>
            item.status ? (
              <Badge size="xs" variant={STATUS_VARIANTS[item.status] ?? 'default'}>
                {formatTrackingStatus(item.status)}
              </Badge>
            ) : (
              <span className="text-doqyn-muted">—</span>
            ),
        },
        {
          key: 'severity',
          header: 'Severidade',
          render: (item) => (
            <Badge size="xs" variant={SEVERITY_VARIANTS[item.severity] ?? 'default'}>
              {item.severity}
            </Badge>
          ),
        },
        {
          key: 'details',
          header: '',
          headerClassName: 'w-12',
          className: 'w-12',
          render: (item) => (
            <IconButton
              label="Ver detalhes"
              onClick={(event) => {
                event.stopPropagation();
                onSelect(item);
              }}
            >
              <Icon name="chevron_right" size={ICON_SIZE.xs} />
            </IconButton>
          ),
        },
      ]}
    />
  );
}
