import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { formatDateTime } from '@/lib/utils';
import type { DocumentTrackingListItem, TrackingListStatus } from '@/types/document-tracking';
import {
  formatSecurityContextDisplay,
  formatSessionOrigin,
  formatTrackingSeverity,
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
  /** Alterna o detalhe aberto embaixo da linha. */
  onToggle: (item: DocumentTrackingListItem) => void;
  expandedId?: string | null;
  renderExpanded: (item: DocumentTrackingListItem) => ReactNode;
  stretch?: boolean;
  sparseAction?: ReactNode;
  footer?: ReactNode;
};

/**
 * A trilha é log: o que se lê fica na linha.
 *
 * Antes, metade do registro — origem do acesso, request, duração, quantas
 * coisas mudaram — só existia atrás de uma seta que abria uma gaveta por cima
 * da lista. Investigar é comparar linhas, e comparar linhas exige vê-las ao
 * mesmo tempo. Agora a linha carrega o registro inteiro, em monoespaçado como
 * todo campo de log, e o que não cabe (metadado cru, diff, contexto completo)
 * abre embaixo dela, no lugar.
 */
export function TrackingEventsTable({
  items,
  onToggle,
  expandedId = null,
  renderExpanded,
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
      onRowClick={onToggle}
      expandedKey={expandedId}
      renderExpanded={renderExpanded}
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
          className: 'w-[150px]',
          render: (item) => (
            <span className="whitespace-nowrap font-mono text-micro tabular-nums text-doqyn-subtle">
              {formatDateTime(item.occurredAt)}
            </span>
          ),
        },
        {
          key: 'action',
          header: 'Ação',
          render: (item) => (
            <div className="min-w-[180px] leading-tight">
              <p className="font-medium text-doqyn-text">{item.summary}</p>
              <p className="font-mono text-micro text-doqyn-subtle">{item.action}</p>
              {item.changesCount ? (
                <p className="register-label mt-0.5 text-doqyn-subtle">
                  {item.changesCount} {item.changesCount === 1 ? 'alteração' : 'alterações'}
                </p>
              ) : null}
            </div>
          ),
        },
        {
          key: 'document',
          header: 'Documento',
          render: (item) => (
            <div className="min-w-0 leading-tight">
              <TrackingDocumentCell
                name={item.document.name}
                versionLabel={item.document.versionLabel}
                versionId={item.versionId}
                documentId={item.document.documentId ?? undefined}
              />
              <p className="font-mono text-micro text-doqyn-subtle">
                {item.document.documentId ?? '—'}
              </p>
            </div>
          ),
        },
        {
          key: 'actor',
          header: 'Usuário',
          render: (item) => (
            <div className="min-w-0 leading-tight">
              <TruncatedText as="p" className="text-doqyn-text">
                {item.actor.displayName ?? item.actor.email ?? item.actor.userId}
              </TruncatedText>
              {item.actor.email && item.actor.displayName ? (
                <TruncatedText as="p" className="font-mono text-micro text-doqyn-subtle">
                  {item.actor.email}
                </TruncatedText>
              ) : null}
            </div>
          ),
        },
        {
          // Investigar acesso é perguntar "de onde". O contexto vinha só na
          // gaveta; agora dispositivo, local e IP mascarado ficam na linha.
          key: 'origin',
          header: 'Origem',
          render: (item) => {
            const origin = formatSecurityContextDisplay(item.security, item.occurredAt);
            if (!origin) return <span className="text-doqyn-subtle">—</span>;
            return (
              <div className="min-w-0 max-w-[220px] leading-tight">
                <TruncatedText as="p" className="text-caption text-doqyn-muted">
                  {origin.deviceLabel}
                </TruncatedText>
                <p className="truncate font-mono text-micro text-doqyn-subtle">
                  {origin.locationLabel} · {origin.ipLabel}
                </p>
              </div>
            );
          },
        },
        {
          key: 'session',
          header: 'Sessão',
          className: 'w-[104px]',
          render: (item) => (
            <span className="font-mono text-micro text-doqyn-subtle">
              {formatSessionOrigin(item.sessionHash)}
            </span>
          ),
        },
        {
          key: 'requestId',
          header: 'Request',
          className: 'w-[120px]',
          render: (item) => (
            <span
              className="block max-w-[120px] truncate font-mono text-micro text-doqyn-subtle"
              title={item.requestId ?? undefined}
            >
              {item.requestId ?? '—'}
            </span>
          ),
        },
        {
          key: 'duration',
          header: 'Duração',
          className: 'w-[84px] text-right',
          headerClassName: 'w-[84px] text-right',
          render: (item) => (
            <span className="font-mono text-micro tabular-nums text-doqyn-subtle">
              {typeof item.durationMs === 'number' ? `${item.durationMs} ms` : '—'}
            </span>
          ),
        },
        {
          key: 'status',
          header: 'Resultado',
          className: 'w-[110px]',
          render: (item) =>
            item.status ? (
              <Badge size="xs" variant={STATUS_VARIANTS[item.status] ?? 'default'} dot>
                {formatTrackingStatus(item.status)}
              </Badge>
            ) : (
              <span className="text-doqyn-subtle">—</span>
            ),
        },
        {
          key: 'severity',
          header: 'Severidade',
          className: 'w-[110px]',
          render: (item) => (
            <Badge size="xs" variant={SEVERITY_VARIANTS[item.severity] ?? 'default'} dot>
              {formatTrackingSeverity(item.severity)}
            </Badge>
          ),
        },
      ]}
    />
  );
}
