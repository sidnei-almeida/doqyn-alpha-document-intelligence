import { useNavigate } from 'react-router-dom';
import { BadgeGroup } from '@/components/ui/BadgeGroup';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { StatusPill } from '@/components/ui/StatusPill';
import { VersionBadge } from '@/components/ui/VersionBadge';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { formatDate } from '@/lib/utils';
import type { DocumentListItem } from '@/types/document-library';
import type { DocumentStatus } from '@/types/document';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { OverviewEmptyHint } from './OverviewEmptyHint';
import { OverviewPanelShell } from './OverviewPanelShell';
import { DocumentFavoriteBadge } from '@/features/library/components/files/DocumentFavoriteBadge';
import { useTranslation } from 'react-i18next';

type RecentDocumentRowProps = {
  doc: DocumentListItem;
  onOpen: (doc: DocumentListItem) => void;
  onTrack: (documentId: string) => void;
};

/** Linha de registro — o ladrilho do ícone saiu, o fio e a régua fazem o trabalho. */
export function RecentDocumentRow({ doc, onOpen, onTrack }: RecentDocumentRowProps) {
  const { t } = useTranslation('dashboard');

  const fileName =
    doc.currentFileName ?? doc.displayName ?? t('overviewRecentDocumentsPanel.documentFallback');
  const meta = `${doc.categoryName ?? doc.documentType ?? '—'} · ${doc.createdBy?.displayName ?? doc.ownerName ?? '—'}`;

  return (
    <div className="overview-row group flex items-center gap-3 py-3 pl-4 pr-1">
      <Icon
        name="description"
        size={ICON_SIZE.xs}
        className="shrink-0 text-doqyn-subtle"
        aria-hidden
      />

      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(doc)}>
        <p className="flex min-w-0 items-center gap-1.5 text-label font-medium leading-snug text-doqyn-text">
          <DocumentFavoriteBadge document={doc} variant="inline" />
          <TruncatedText as="span" className="min-w-0 flex-1">
            {fileName}
          </TruncatedText>
        </p>
        <TruncatedText as="p" className="overview-row-meta mt-1">
          {meta}
        </TruncatedText>
      </button>

      <time className="overview-timestamp hidden shrink-0 whitespace-nowrap lg:block">
        {formatDate(doc.updatedAt)}
      </time>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <div className="hidden sm:flex">
          <BadgeGroup align="end">
            <StatusPill status={(doc.status as DocumentStatus) ?? 'active'} size="xs" dot />
            <VersionBadge version={doc.versionLabel ?? `v${doc.version}`} isCurrent size="xs" />
          </BadgeGroup>
        </div>
        <div className="flex items-center opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
          {doc.permissions?.canPreview && doc.latestVersionId && (
            <IconButton
              label={t('overviewRecentDocumentsPanel.visualizar')}
              onClick={() => onOpen(doc)}
            >
              <Icon name="visibility" size={ICON_SIZE.xs} />
            </IconButton>
          )}
          {doc.permissions?.canViewTracking && (
            <IconButton
              label={t('overviewRecentDocumentsPanel.tracking')}
              onClick={() => onTrack(doc.documentId)}
            >
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
  const { t } = useTranslation('dashboard');

  const navigate = useNavigate();

  return (
    <OverviewPanelShell
      title={t('overviewRecentDocumentsPanel.documentosRecentes')}
      subtitle={t('overviewRecentDocumentsPanel.subtitle')}
      titleId="overview-recent-documents-title"
      actionLabel={t('overviewRecentDocumentsPanel.viewAll')}
      onAction={() => navigate('/library')}
      bodyClassName="flex-1"
      data-testid="overview-recent-documents"
    >
      {isEmpty ? (
        <OverviewEmptyHint
          icon="description"
          title={t('overviewRecentDocumentsPanel.nenhumDocumentoEnviadoAinda')}
          description={t('overviewRecentDocumentsPanel.oPrimeiroEnvioComeca')}
        />
      ) : (
        <div className="flex flex-col">
          {documents.map((doc) => (
            <RecentDocumentRow
              key={doc.documentId}
              doc={doc}
              onOpen={onOpen}
              onTrack={(documentId) =>
                navigate(`/tracking?documentId=${encodeURIComponent(documentId)}`)
              }
            />
          ))}
        </div>
      )}
    </OverviewPanelShell>
  );
}
