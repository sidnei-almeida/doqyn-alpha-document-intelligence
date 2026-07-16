import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { BadgeGroup } from '@/components/ui/BadgeGroup';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { StatusPill } from '@/components/ui/StatusPill';
import { VersionBadge } from '@/components/ui/VersionBadge';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import type { DocumentListItem } from '@/types/document-library';
import type { DocumentStatus } from '@/types/document';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { OverviewEmptyHint } from './OverviewEmptyHint';
import { OverviewPanelShell } from './OverviewPanelShell';
import { DocumentFavoriteBadge } from '@/features/library/components/files/DocumentFavoriteBadge';

type RecentDocumentRowProps = {
  doc: DocumentListItem;
  onOpen: (doc: DocumentListItem) => void;
  onTrack: (documentId: string) => void;
  isSolo?: boolean;
};

export function RecentDocumentRow({
  doc,
  onOpen,
  onTrack,
  isSolo = false,
}: RecentDocumentRowProps) {
  const fileName = doc.currentFileName ?? doc.displayName ?? 'Documento';
  const meta = `${doc.categoryName ?? doc.documentType ?? '—'} · ${doc.createdBy?.displayName ?? doc.ownerName ?? '—'}`;

  return (
    <div
      className={cn(
        'overview-interactive-row group flex items-center gap-3 rounded-xl px-2 py-3 sm:px-3',
        isSolo && 'min-h-[4.5rem] px-3 sm:px-4',
      )}
    >
      <span
        className="bg-doqyn-card/70 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-doqyn-muted"
        aria-hidden
      >
        <Icon name="description" size={ICON_SIZE.xs} />
      </span>

      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(doc)}>
        <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium leading-snug text-doqyn-text">
          <DocumentFavoriteBadge document={doc} variant="inline" />
          <TruncatedText as="span" className="min-w-0 flex-1">
            {fileName}
          </TruncatedText>
        </p>
        <TruncatedText as="p" className="overview-row-meta mt-0.5">
          {meta}
        </TruncatedText>
      </button>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <div className="hidden sm:flex">
          <BadgeGroup align="end">
            <StatusPill status={(doc.status as DocumentStatus) ?? 'active'} size="xs" dot />
            <VersionBadge version={doc.versionLabel ?? `v${doc.version}`} isCurrent size="xs" />
          </BadgeGroup>
        </div>
        <div className="flex items-center opacity-70 transition-opacity duration-[var(--transition-duration)] group-hover:opacity-100">
          {doc.permissions?.canPreview && doc.latestVersionId && (
            <IconButton label="Visualizar" onClick={() => onOpen(doc)}>
              <Icon name="visibility" size={ICON_SIZE.xs} />
            </IconButton>
          )}
          {doc.permissions?.canViewTracking && (
            <IconButton label="Tracking" onClick={() => onTrack(doc.documentId)}>
              <Icon name="history" size={ICON_SIZE.xs} />
            </IconButton>
          )}
        </div>
      </div>
    </div>
  );
}

type OverviewRecentDocumentsPanelProps = {
  documents: DocumentListItem[];
  isEmpty: boolean;
  onOpen: (doc: DocumentListItem) => void;
};

export function OverviewRecentDocumentsPanel({
  documents,
  isEmpty,
  onOpen,
}: OverviewRecentDocumentsPanelProps) {
  const navigate = useNavigate();
  const isSolo = documents.length === 1;

  return (
    <OverviewPanelShell
      variant="primary"
      title="Documentos recentes"
      subtitle="Últimos envios e atualizações do ambiente"
      titleId="overview-recent-documents-title"
      actionLabel="Ver todos"
      onAction={() => navigate('/biblioteca')}
      className="h-full min-h-[18rem]"
      bodyClassName="overview-panel-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-0 sm:px-3 sm:pb-4"
      data-testid="overview-recent-documents"
    >
      {isEmpty ? (
        <OverviewEmptyHint
          title="Nenhum documento enviado ainda"
          description="Envie o primeiro documento para acompanhar métricas e atividade."
          action={
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => navigate('/biblioteca')}
            >
              Ir para Biblioteca
            </Button>
          }
        />
      ) : (
        <div className={cn('flex flex-col gap-0.5', isSolo && 'justify-center py-2')}>
          {documents.map((doc) => (
            <RecentDocumentRow
              key={doc.documentId}
              doc={doc}
              onOpen={onOpen}
              onTrack={(documentId) =>
                navigate(`/tracking?documentId=${encodeURIComponent(documentId)}`)
              }
              isSolo={isSolo}
            />
          ))}
        </div>
      )}
    </OverviewPanelShell>
  );
}
