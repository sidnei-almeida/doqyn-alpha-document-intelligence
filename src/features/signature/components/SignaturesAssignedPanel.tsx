import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import type { AssignedSignatureRequestItem } from '@/features/signature/api/signatureApi';
import { useAssignedSignatureRequests } from '@/features/signature/hooks/useAssignedSignatureRequests';

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return 'Pendente';
    case 'signed':
      return 'Assinado';
    case 'declined':
      return 'Recusado';
    case 'expired':
      return 'Expirado';
    case 'cancelled':
      return 'Cancelado';
    default:
      return status;
  }
}

function statusVariant(status: string): 'pending' | 'success' | 'danger' | 'warning' | 'info' {
  switch (status) {
    case 'signed':
      return 'success';
    case 'declined':
    case 'cancelled':
      return 'danger';
    case 'expired':
      return 'warning';
    default:
      return 'pending';
  }
}

function filterItems(
  items: AssignedSignatureRequestItem[],
  query: string,
): AssignedSignatureRequestItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const haystack = [item.documentName, item.requestedBy, item.versionLabel]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

type SignaturesAssignedPanelProps = {
  search?: string;
};

export function SignaturesAssignedPanel({ search = '' }: SignaturesAssignedPanelProps) {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useAssignedSignatureRequests();
  const items = useMemo(() => filterItems(data?.items ?? [], search), [data?.items, search]);

  if (isLoading) {
    return (
      <div className="space-y-3" data-testid="signatures-assigned-loading" aria-busy="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="skeleton-line h-16 rounded-xl bg-doqyn-card" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p
        className="text-label font-normal text-doqyn-danger"
        data-testid="signatures-assigned-error"
      >
        Não foi possível carregar as assinaturas pendentes.
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <div
        className="flex min-h-[min(360px,45vh)] flex-col items-center justify-center px-6 py-16 text-center"
        data-testid="signatures-assigned-empty"
      >
        <Icon name="draw" size={ICON_SIZE.md} className="mb-4 text-doqyn-border-strong" />
        <p className="text-label font-medium text-doqyn-text">Nada aguardando sua assinatura</p>
        <p className="mt-1.5 max-w-[42ch] text-caption leading-relaxed text-doqyn-muted">
          Quando alguém pedir sua assinatura, o documento aparece aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-doqyn-border-subtle" data-testid="signatures-assigned-list">
      {items.map((item) => (
        <div
          key={item.signatureRequestId}
          className="group relative flex flex-wrap items-center justify-between gap-3 border-b border-doqyn-border-subtle py-3.5 pl-4 pr-2 transition-colors before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-transparent hover:bg-doqyn-hover/40 hover:before:bg-doqyn-accent-active"
          data-testid={`signature-assigned-item-${item.signatureRequestId}`}
        >
          <div className="min-w-0">
            <p className="truncate text-label font-medium text-doqyn-text">{item.documentName}</p>
            <p className="mt-1 text-caption text-doqyn-muted">
              Solicitado por {item.requestedBy}
              {item.versionLabel ? ` · v${item.versionLabel}` : ''}
            </p>
            <p className="mt-0.5 font-mono text-micro tabular-nums text-doqyn-subtle">
              {formatDateTime(item.requestedAt)}
              {item.expiresAt ? ` · expira ${formatDateTime(item.expiresAt)}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant={statusVariant(item.signerStatus)}>
              {statusLabel(item.signerStatus)}
            </Badge>
            {item.canSign ? (
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  navigate(`/assinaturas/${encodeURIComponent(item.signatureRequestId)}`)
                }
                data-testid={`signature-assigned-open-${item.signatureRequestId}`}
              >
                Abrir e assinar
              </Button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
