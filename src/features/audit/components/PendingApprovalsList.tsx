import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { formatDate } from '@/lib/utils';
import type { PendingApprovalItem } from '../api/pendingApprovalsApi';
import { PENDING_TYPE_LABELS } from '../api/pendingApprovalsApi';
import { AuditEmptyState } from './AuditEmptyState';

type PendingApprovalsListProps = {
  items: PendingApprovalItem[];
  isAdmin: boolean;
  loading?: boolean;
  onReview: (item: PendingApprovalItem) => void;
  onApprove: (item: PendingApprovalItem) => void;
  onReject: (item: PendingApprovalItem) => void;
};

export function PendingApprovalsList({
  items,
  isAdmin,
  loading,
  onReview,
  onApprove,
  onReject,
}: PendingApprovalsListProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-14 animate-pulse rounded-lg border border-doqyn-border bg-doqyn-card"
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <AuditEmptyState
        icon={<Icon name="assignment" size={ICON_SIZE.nav} />}
        title="Não há pendências no momento."
        description="Novas solicitações de acesso aparecerão aqui para revisão."
      />
    );
  }

  return (
    <DataTable
      data={items}
      keyExtractor={(item) => item.id}
      columns={[
        {
          key: 'name',
          header: 'Solicitante',
          render: (item) => (
            <div>
              <p className="font-medium text-doqyn-text">{item.name}</p>
              <p className="text-xs text-doqyn-muted">{item.email}</p>
            </div>
          ),
        },
        {
          key: 'tenant',
          header: 'Organização',
          render: (item) => (
            <div className="min-w-0 max-w-[220px]">
              <TruncatedText as="p" className="text-sm text-doqyn-text">
                {item.tenantName ?? item.tenantId}
              </TruncatedText>
              {item.tenantName && item.tenantName !== item.tenantId && (
                <TruncatedText as="p" className="text-[11px] text-doqyn-muted">
                  {item.tenantId}
                </TruncatedText>
              )}
            </div>
          ),
        },
        {
          key: 'type',
          header: 'Tipo',
          render: (item) => (
            <span className="text-sm text-doqyn-muted">{PENDING_TYPE_LABELS[item.type]}</span>
          ),
        },
        {
          key: 'requestedAt',
          header: 'Data',
          render: (item) => (
            <span className="text-sm text-doqyn-muted">{formatDate(item.requestedAt)}</span>
          ),
        },
        {
          key: 'status',
          header: 'Status',
          render: () => <Badge variant="warning">Pendente</Badge>,
        },
        {
          key: 'actions',
          header: 'Ação',
          className: 'w-[280px]',
          render: (item) => (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => onReview(item)}>
                <Icon name="visibility" size={14} />
                Revisar
              </Button>
              {isAdmin && (
                <>
                  <Button type="button" size="sm" onClick={() => onApprove(item)}>
                    Aprovar
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => onReject(item)}>
                    Rejeitar
                  </Button>
                </>
              )}
              <Link
                to="/users"
                className="inline-flex items-center gap-1 text-xs text-doqyn-primary hover:underline"
              >
                Usuários
                <Icon name="open_in_new" size={12} />
              </Link>
            </div>
          ),
        },
      ]}
    />
  );
}
