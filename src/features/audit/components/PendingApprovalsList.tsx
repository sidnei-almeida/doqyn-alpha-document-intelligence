import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { TableRowActionsMenu } from '@/components/ui/TableRowActionsMenu';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { formatDateTime } from '@/lib/utils';
import type { PendingApprovalItem } from '../api/pendingApprovalsApi';
import { PENDING_TYPE_LABELS } from '../api/pendingApprovalsApi';
import { AuditEmptyState } from './AuditEmptyState';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('audit');

  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="border-t border-doqyn-border" aria-hidden>
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex h-[52px] items-center border-b border-doqyn-border-subtle/75 px-4"
          >
            <div className="h-2 w-1/4 animate-pulse bg-doqyn-border-subtle" />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <AuditEmptyState
        className="border-t border-doqyn-border"
        title={t('pendingApprovalsList.naoHaPendenciasNo')}
        description={t('pendingApprovalsList.enviosDownloadsECompartilhamentos')}
      />
    );
  }

  return (
    <DataTable
      data={items}
      keyExtractor={(item) => item.id}
      onRowClick={onReview}
      sparseMessage="Só isto na fila"
      sparseDescription="Novas solicitações aparecem aqui assim que chegarem."
      columns={[
        {
          key: 'name',
          header: 'Solicitante',
          render: (item) => (
            <div className="min-w-0">
              <p className="truncate font-medium text-doqyn-text">{item.name}</p>
              <p className="meta-text truncate">{item.email}</p>
            </div>
          ),
        },
        {
          key: 'tenant',
          header: 'Organização',
          render: (item) => (
            <div className="min-w-0 max-w-[220px]">
              <TruncatedText as="p" className="text-doqyn-text">
                {item.tenantName ?? item.tenantId}
              </TruncatedText>
              {item.tenantName && item.tenantName !== item.tenantId && (
                <TruncatedText as="p" className="font-mono text-micro text-doqyn-subtle">
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
            <span className="text-doqyn-muted">{PENDING_TYPE_LABELS[item.type]}</span>
          ),
        },
        {
          key: 'requestedAt',
          header: 'Data',
          className: 'w-[168px]',
          render: (item) => (
            <span className="whitespace-nowrap font-mono text-micro tabular-nums text-doqyn-subtle">
              {formatDateTime(item.requestedAt)}
            </span>
          ),
        },
        {
          key: 'status',
          header: 'Status',
          className: 'w-[116px]',
          render: () => (
            <Badge variant="pending" dot>
              {t('pendingApprovalsList.pendente')}
            </Badge>
          ),
        },
        {
          // Três botões preenchidos por linha davam a cada pendência o peso de
          // uma barra de ações. A linha abre a revisão; aprovar e rejeitar
          // moram no mesmo menu de linha das outras telas.
          key: 'actions',
          header: '',
          headerClassName: 'w-12 text-right',
          className: 'w-12 text-right',
          render: (item) => (
            <TableRowActionsMenu
              actions={[
                { label: 'Revisar', onClick: () => onReview(item) },
                { label: 'Aprovar', onClick: () => onApprove(item), hidden: !isAdmin },
                {
                  label: 'Rejeitar',
                  onClick: () => onReject(item),
                  tone: 'danger',
                  hidden: !isAdmin,
                },
                {
                  label: 'Abrir em Usuários',
                  onClick: () => navigate('/users'),
                  hidden: item.type === 'document_upload',
                },
              ]}
            />
          ),
        },
      ]}
    />
  );
}
