import { ExternalLink, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { formatDate } from '@/lib/utils';
import type { PendingApprovalItem } from '../api/pendingApprovalsApi';
import { PENDING_TYPE_LABELS } from '../api/pendingApprovalsApi';
import { AuditEmptyState } from './AuditEmptyState';
import { ClipboardList } from 'lucide-react';

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
        icon={<ClipboardList className="h-5 w-5" />}
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
            <span className="text-sm text-doqyn-text">{item.tenantName ?? item.tenantId}</span>
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
                <Eye className="h-3.5 w-3.5" />
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
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          ),
        },
      ]}
    />
  );
}
