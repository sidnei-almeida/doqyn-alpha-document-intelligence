import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { FileThumbnail } from '@/components/ui/FileThumbnail';
import { FileTypeIcon } from '@/components/ui/FileTypeIcon';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { cn, formatDate } from '@/lib/utils';
import type { DocumentListItem } from '@/types/document-library';
import { fetchDocumentTimeline } from '../../api/documentTimelineApi';
import { formatStorageBytes } from '../../utils/buildOverviewMetrics';
import { formatRelativeTime } from '../../utils/formatRelativeTime';

type PanelTab = 'detalhes' | 'atividade';

type HomeDocumentPanelProps = {
  doc: DocumentListItem;
  onClose: () => void;
  onOpenViewer: (doc: DocumentListItem) => void;
};

function fileExtensionLabel(fileName: string): string {
  const ext = fileName.split('.').pop();
  if (!ext || ext === fileName) return 'Documento';
  return `${ext.toUpperCase()}`;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="type-caption shrink-0 text-doqyn-subtle">{label}</dt>
      <dd className="type-body min-w-0 truncate text-right text-doqyn-text">{value}</dd>
    </div>
  );
}

/** Painel direito de documento — hero, ficha e atividade, estilo Drive. */
export function HomeDocumentPanel({ doc, onClose, onOpenViewer }: HomeDocumentPanelProps) {
  const canViewTracking = Boolean(doc.permissions?.canViewTracking);
  const [tab, setTab] = useState<PanelTab>('detalhes');
  const activeTab: PanelTab = tab === 'atividade' && !canViewTracking ? 'detalhes' : tab;

  const timelineQuery = useQuery({
    queryKey: ['dashboard-document-timeline', doc.documentId],
    queryFn: () => fetchDocumentTimeline(doc.documentId),
    enabled: activeTab === 'atividade' && canViewTracking,
    staleTime: 30_000,
  });

  const people = [
    { userId: doc.ownerUserId, name: doc.ownerName },
    doc.updatedBy && doc.updatedBy !== doc.ownerUserId
      ? { userId: doc.updatedBy, name: doc.updatedByName }
      : null,
  ].filter(Boolean) as Array<{ userId: string; name?: string }>;

  return (
    <aside
      aria-label={`Detalhes de ${doc.displayName}`}
      className="flex h-fit flex-col rounded-xl border border-doqyn-border-subtle bg-doqyn-surface"
    >
      <div className="flex items-center gap-2.5 px-4 pt-3.5">
        <FileTypeIcon fileName={doc.currentFileName} size={18} />
        <h2 className="type-label min-w-0 flex-1 truncate text-doqyn-text">{doc.displayName}</h2>
        <IconButton label="Fechar detalhes" className="h-8 min-h-8 w-8 min-w-8" onClick={onClose}>
          <Icon name="close" size={16} />
        </IconButton>
      </div>

      <div className="mt-2 flex gap-1 border-b border-doqyn-border-subtle px-4">
        {(
          [
            { id: 'detalhes' as const, label: 'Detalhes', visible: true },
            { id: 'atividade' as const, label: 'Atividade', visible: canViewTracking },
          ] satisfies Array<{ id: PanelTab; label: string; visible: boolean }>
        )
          .filter((item) => item.visible)
          .map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                'border-b-2 px-3 py-2 font-display text-label font-medium transition-colors',
                activeTab === item.id
                  ? 'border-doqyn-primary text-doqyn-text'
                  : 'border-transparent text-doqyn-muted hover:text-doqyn-text',
              )}
            >
              {item.label}
            </button>
          ))}
      </div>

      {activeTab === 'detalhes' && (
        <div className="flex flex-col gap-4 p-4">
          <div className="h-40 overflow-hidden rounded-lg bg-doqyn-thumbnail-chrome">
            <FileThumbnail
              fileName={doc.currentFileName}
              documentId={doc.documentId}
              versionId={doc.latestVersionId ?? doc.currentVersionId}
              canPreview={doc.permissions?.canPreview}
              className="h-full w-full"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex -space-x-2">
              {people.map((person) => (
                <span key={person.userId} className="rounded-full ring-2 ring-doqyn-surface">
                  <UserAvatar userId={person.userId} name={person.name} size="sm" />
                </span>
              ))}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!doc.permissions?.canPreview}
              onClick={() => onOpenViewer(doc)}
            >
              <Icon name="open_in_new" size={15} />
              Abrir documento
            </Button>
          </div>

          <div>
            <h3 className="type-label mb-1 text-doqyn-muted">Detalhes do arquivo</h3>
            <dl className="divide-y divide-doqyn-border-subtle">
              <DetailRow label="Tipo" value={fileExtensionLabel(doc.currentFileName)} />
              <DetailRow
                label="Tamanho"
                value={
                  typeof doc.fileSizeBytes === 'number'
                    ? formatStorageBytes(doc.fileSizeBytes)
                    : '—'
                }
              />
              <DetailRow label="Categoria" value={doc.categoryName ?? '—'} />
              <DetailRow label="Proprietário" value={doc.ownerName ?? '—'} />
              <DetailRow
                label="Modificado"
                value={`${formatDate(doc.updatedAt)}${doc.updatedByName ? ` por ${doc.updatedByName}` : ''}`}
              />
              <DetailRow label="Criado" value={formatDate(doc.createdAt)} />
              {doc.versionLabel && <DetailRow label="Versão" value={doc.versionLabel} />}
            </dl>
          </div>
        </div>
      )}

      {activeTab === 'atividade' && (
        <div className="flex flex-col gap-1 px-2 py-3">
          {timelineQuery.isLoading && (
            <p className="type-caption px-2 py-2 text-doqyn-subtle">Carregando atividade…</p>
          )}
          {timelineQuery.isError && (
            <p className="type-caption px-2 py-2 text-doqyn-danger">
              Não foi possível carregar a atividade.
            </p>
          )}
          {timelineQuery.data?.length === 0 && (
            <p className="type-caption px-2 py-2 text-doqyn-subtle">
              Nenhum evento registrado ainda.
            </p>
          )}
          {timelineQuery.data?.map((event) => (
            <article key={event.id} className="flex items-start gap-2.5 rounded-lg px-2 py-2">
              <UserAvatar
                userId={event.actor.userId}
                name={event.actor.displayName ?? 'Usuário'}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="type-body leading-snug text-doqyn-text">
                  <span className="font-medium">{event.actor.displayName ?? 'Usuário'}</span>
                </p>
                <p className="type-caption mt-0.5 text-doqyn-muted">{event.summary}</p>
              </div>
              <time className="type-caption shrink-0 whitespace-nowrap pt-0.5 text-doqyn-subtle">
                {formatRelativeTime(event.occurredAt)}
              </time>
            </article>
          ))}
        </div>
      )}
    </aside>
  );
}
