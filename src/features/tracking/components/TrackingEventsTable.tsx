import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';
import type { DocumentTrackingListItem } from '@/types/document-tracking';
import { formatTrackingAction } from '../utils/trackingDisplay';
import { TrackingDocumentCell } from './TrackingDocumentCell';

const SEVERITY_VARIANTS = {
  info: 'info',
  warning: 'warning',
  error: 'danger',
  critical: 'danger',
  debug: 'default',
} as const;

type TrackingEventsTableProps = {
  items: DocumentTrackingListItem[];
  onSelect: (item: DocumentTrackingListItem) => void;
};

export function TrackingEventsTable({ items, onSelect }: TrackingEventsTableProps) {
  return (
    <DataTable
      data={items}
      keyExtractor={(item) => item.id}
      emptyMessage="Nenhum evento documental encontrado para os filtros selecionados."
      columns={[
        {
          key: 'occurredAt',
          header: 'Data/hora',
          render: (item) => (
            <span className="whitespace-nowrap text-doqyn-muted">{formatDate(item.occurredAt)}</span>
          ),
        },
        {
          key: 'action',
          header: 'Ação',
          render: (item) => (
            <div className="min-w-[140px]">
              <p className="font-medium text-doqyn-text">{item.summary}</p>
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
            />
          ),
        },
        {
          key: 'actor',
          header: 'Usuário',
          render: (item) => (
            <span className="text-doqyn-muted">
              {item.actor.displayName ?? item.actor.email ?? item.actor.userId}
            </span>
          ),
        },
        {
          key: 'severity',
          header: 'Severidade',
          render: (item) => (
            <Badge variant={SEVERITY_VARIANTS[item.severity] ?? 'default'}>{item.severity}</Badge>
          ),
        },
        {
          key: 'details',
          header: '',
          render: (item) => (
            <Button variant="ghost" size="sm" onClick={() => onSelect(item)}>
              Ver detalhes
            </Button>
          ),
        },
      ]}
    />
  );
}
