import { BadgeGroup } from '@/components/ui/BadgeGroup';
import { DrawerField, DrawerSection } from '@/components/ui/DrawerSection';
import { StatusPill } from '@/components/ui/StatusPill';
import { VersionBadge } from '@/components/ui/VersionBadge';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { DocumentThumbnail } from '@/features/documents/preview/DocumentThumbnail';
import { DocumentFavoriteBadge } from '@/features/library/components/files/DocumentFavoriteBadge';
import {
  documentCanPreview,
  documentDisplayName,
  resolveDocumentVersionId,
} from '@/features/library/components/files/documentFileUtils';
import { formatDate } from '@/lib/utils';
import type { DocumentStatus } from '@/types/document';
import type { DocumentListItem } from '@/types/document-library';
import { useTranslation } from 'react-i18next';

type CurrentDocumentSummaryCardProps = {
  document: DocumentListItem;
  currentVersionLabel: string;
  fileSizeLabel?: string;
  compact?: boolean;
};

export function CurrentDocumentSummaryCard({
  document,
  currentVersionLabel,
  fileSizeLabel,
  compact = false,
}: CurrentDocumentSummaryCardProps) {
  const { t } = useTranslation('documentVersion');

  const name = documentDisplayName(document);
  const versionId = resolveDocumentVersionId(document);

  if (compact) {
    return (
      <DrawerSection
        label={t('currentDocumentSummaryCard.documentoAtual')}
        aside={<VersionBadge version={currentVersionLabel} isCurrent size="xs" />}
        className="border-t-0 pt-0"
        data-testid="update-version-current-summary"
      >
        <div className="flex gap-4">
          <div className="relative w-[132px] shrink-0">
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[4px] border border-doqyn-border-subtle bg-doqyn-thumbnail-chrome [&_img]:object-contain [&_img]:object-top">
              <DocumentThumbnail
                fileName={name}
                documentId={document.documentId}
                versionId={versionId}
                canPreview={documentCanPreview(document)}
                previewStatus={document.preview?.status}
                size="large"
                className="absolute inset-0 h-full w-full"
                iconClassName="h-10 w-10 text-doqyn-muted"
              />
              <DocumentFavoriteBadge document={document} variant="overlay" />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <TruncatedText className="text-label font-medium leading-snug text-doqyn-text">
              {name}
            </TruncatedText>
            <BadgeGroup className="mt-2">
              <StatusPill status={(document.status as DocumentStatus) ?? 'active'} size="xs" dot />
              <DocumentFavoriteBadge document={document} variant="inline" />
            </BadgeGroup>
            <dl className="mt-3">
              <DrawerField
                label={t('currentDocumentSummaryCard.categoria')}
                value={document.categoryName ?? document.documentType ?? '—'}
              />
              <DrawerField
                label={t('currentDocumentSummaryCard.proprietario')}
                value={document.createdBy?.displayName ?? document.ownerName ?? '—'}
              />
              <DrawerField
                label={t('currentDocumentSummaryCard.atualizado')}
                value={formatDate(document.updatedAt)}
                mono
              />
              {document.processingStatus && (
                <DrawerField
                  label={t('currentDocumentSummaryCard.processamento')}
                  value={document.processingStatus}
                />
              )}
              {fileSizeLabel && (
                <DrawerField
                  label={t('currentDocumentSummaryCard.tamanho')}
                  value={fileSizeLabel}
                  mono
                />
              )}
            </dl>
          </div>
        </div>
      </DrawerSection>
    );
  }

  return (
    <section
      className="rounded-xl border border-doqyn-border-subtle bg-doqyn-bg/40 p-4"
      data-testid="update-version-current-summary"
    >
      <p className="mb-3 text-[12px] font-medium text-doqyn-text">
        {t('currentDocumentSummaryCard.documentoAtual2')}
      </p>
      <div className="flex gap-4">
        <div className="relative w-[160px] shrink-0">
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg border border-doqyn-border-subtle bg-doqyn-thumbnail-chrome [&_img]:object-contain [&_img]:object-top">
            <DocumentThumbnail
              fileName={name}
              documentId={document.documentId}
              versionId={versionId}
              canPreview={documentCanPreview(document)}
              previewStatus={document.preview?.status}
              size="large"
              className="absolute inset-0 h-full w-full"
            />
            <DocumentFavoriteBadge document={document} variant="overlay" />
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="break-words text-[14px] font-medium text-doqyn-text">{name}</p>
          <BadgeGroup>
            <StatusPill status={(document.status as DocumentStatus) ?? 'active'} size="sm" dot />
            <VersionBadge version={currentVersionLabel} isCurrent size="sm" />
            <DocumentFavoriteBadge document={document} variant="inline" />
          </BadgeGroup>
          <dl className="grid gap-1 text-[12px] sm:grid-cols-2">
            <div>
              <dt className="text-doqyn-muted">{t('currentDocumentSummaryCard.categoria2')}</dt>
              <dd className="text-doqyn-text">
                {document.categoryName ?? document.documentType ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-doqyn-muted">{t('currentDocumentSummaryCard.proprietario2')}</dt>
              <dd className="text-doqyn-text">
                {document.createdBy?.displayName ?? document.ownerName ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-doqyn-muted">{t('currentDocumentSummaryCard.criado')}</dt>
              <dd className="text-doqyn-text">{formatDate(document.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-doqyn-muted">{t('currentDocumentSummaryCard.atualizado2')}</dt>
              <dd className="text-doqyn-text">{formatDate(document.updatedAt)}</dd>
            </div>
            <div>
              <dt className="text-doqyn-muted">{t('currentDocumentSummaryCard.processamento2')}</dt>
              <dd className="text-doqyn-text">{document.processingStatus ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-doqyn-muted">{t('currentDocumentSummaryCard.tipoTamanho')}</dt>
              <dd className="text-doqyn-text">
                {name.split('.').pop()?.toUpperCase() ?? 'PDF'}
                {fileSizeLabel ? ` · ${fileSizeLabel}` : ''}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
