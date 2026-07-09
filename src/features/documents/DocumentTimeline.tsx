import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { DocumentTimelineItem } from '@/types/document-audit';

type DocumentTimelineProps = {
  documentId: string;
  actionPrefix?: string;
};

function TimelineEntry({ item }: { item: DocumentTimelineItem }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails =
    Boolean(item.changes?.length) ||
    Boolean(item.metadata && Object.keys(item.metadata).length > 0);

  return (
    <div className="rounded-lg border border-doqyn-border/60 bg-doqyn-surface/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-doqyn-text">{item.summary}</p>
            <Badge variant={item.severity === 'error' ? 'danger' : 'default'}>{item.severity}</Badge>
          </div>
          <p className="mt-1 text-xs text-doqyn-muted">
            {item.actor.displayName ?? item.actor.email ?? item.actor.userId} ·{' '}
            {formatDate(item.occurredAt)}
          </p>
          {item.versionId ? (
            <p className="mt-1 text-xs text-doqyn-muted">Versão: {item.versionId}</p>
          ) : null}
        </div>
        {hasDetails ? (
          <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
            <Icon name={expanded ? 'expand_less' : 'expand_more'} size={ICON_SIZE.sm} />
          </Button>
        ) : null}
      </div>

      {expanded && item.changes?.length ? (
        <div className="mt-3 space-y-2 border-t border-doqyn-border/40 pt-3">
          {item.changes.map((change) => (
            <div key={change.field} className="text-xs">
              <p className="font-medium text-doqyn-text">{change.field}</p>
              <p className="text-doqyn-muted">
                <span className="line-through">{String(change.before ?? '—')}</span>
                {' → '}
                <span>{String(change.after ?? '—')}</span>
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {expanded && item.metadata ? (
        <pre className="mt-3 max-h-40 overflow-auto rounded bg-doqyn-bg/60 p-2 text-[11px] text-doqyn-muted">
          {JSON.stringify(item.metadata, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

export function DocumentTimeline({ documentId, actionPrefix }: DocumentTimelineProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['document-timeline', documentId, actionPrefix],
    queryFn: () => api.documents.timeline(documentId, actionPrefix ? { actionPrefix } : undefined),
    enabled: Boolean(documentId),
  });

  if (isLoading) {
    return <p className="text-sm text-doqyn-muted">Carregando histórico...</p>;
  }

  if (isError) {
    return <p className="text-sm text-doqyn-danger">Não foi possível carregar o histórico.</p>;
  }

  const items = data?.items ?? [];
  if (!items.length) {
    return (
      <EmptyState
        title="Sem eventos"
        description="Nenhum evento de auditoria registrado para este documento."
      />
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <TimelineEntry key={item.id} item={item} />
      ))}
    </div>
  );
}
