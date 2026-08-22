import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { ExpiryAlert } from '../api/expiryApi';

export type ExpiryAlertListProps = {
  alerts: ExpiryAlert[];
  isLoading: boolean;
  onMarkRead: (alertId: string) => void;
  onDismiss: (alertId: string) => void;
  compact?: boolean;
};

/**
 * Urgência derivada dos dias restantes, não do marco configurado: o que importa para quem lê é
 * quanto tempo sobra, e o mesmo marco de 7 dias pode chegar com atraso.
 */
function urgencyVariant(daysRemaining: number): 'danger' | 'warning' | 'neutral' {
  if (daysRemaining < 0) return 'danger';
  if (daysRemaining <= 7) return 'warning';
  return 'neutral';
}

function urgencyLabel(daysRemaining: number): string {
  if (daysRemaining < 0) {
    const days = Math.abs(daysRemaining);
    return `Vencido há ${days} dia${days === 1 ? '' : 's'}`;
  }
  if (daysRemaining === 0) return 'Vence hoje';
  return `Vence em ${daysRemaining} dia${daysRemaining === 1 ? '' : 's'}`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR');
}

export function ExpiryAlertList({
  alerts,
  isLoading,
  onMarkRead,
  onDismiss,
  compact = false,
}: ExpiryAlertListProps) {
  if (isLoading) {
    return <p className="text-muted-foreground p-4 text-sm">Carregando alertas…</p>;
  }

  if (alerts.length === 0) {
    return (
      <EmptyState
        title="Nenhum vencimento à vista"
        description="Documentos com vencimento configurado aparecem aqui conforme a data se aproxima."
      />
    );
  }

  return (
    <ul className="divide-border divide-y">
      {alerts.map((alert) => (
        <li
          key={alert.id}
          className={`flex items-start justify-between gap-3 p-3 ${
            alert.status === 'unread' ? 'bg-accent/30' : ''
          }`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={urgencyVariant(alert.daysRemaining)}>
                {urgencyLabel(alert.daysRemaining)}
              </Badge>
              {alert.categoryName && !compact && (
                <span className="text-muted-foreground text-xs">{alert.categoryName}</span>
              )}
            </div>

            <Link
              to={`/biblioteca?documentId=${encodeURIComponent(alert.documentId)}`}
              className="mt-1 block truncate text-sm font-medium hover:underline"
              title={alert.documentName}
            >
              {alert.documentName}
            </Link>

            <p className="text-muted-foreground text-xs">
              Vencimento em {formatDate(alert.validityDate)}
            </p>
          </div>

          <div className="flex shrink-0 gap-1">
            {alert.status === 'unread' && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onMarkRead(alert.id)}>
                Marcar lido
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={() => onDismiss(alert.id)}>
              Dispensar
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
