import type { ReactNode } from 'react';
import { BadgeGroup } from '@/components/ui/BadgeGroup';
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

type CurrentDocumentSummaryCardProps = {
  document: DocumentListItem;
  currentVersionLabel: string;
  fileSizeLabel?: string;
  compact?: boolean;
};

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="shrink-0 text-[11px] text-doqyn-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right text-[11px] text-doqyn-text">{value}</dd>
    </div>
  );
}

export function CurrentDocumentSummaryCard({
  document,
  currentVersionLabel,
  fileSizeLabel,
  compact = false,
}: CurrentDocumentSummaryCardProps) {
  const name = documentDisplayName(document);
  const versionId = resolveDocumentVersionId(document);

  if (compact) {
    return (
      <section
        className="rounded-xl border border-doqyn-border-subtle bg-doqyn-bg/40 p-3"
        data-testid="update-version-current-summary"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-doqyn-muted">
            Documento atual
          </p>
          <VersionBadge version={currentVersionLabel} isCurrent size="xs" />
        </div>

        <div className="flex gap-3">
          <div className="relative w-[150px] shrink-0">
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg border border-doqyn-border-subtle bg-doqyn-thumbnail-chrome shadow-sm [&_img]:object-contain [&_img]:object-top">
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
            <TruncatedText className="text-[13px] font-medium leading-snug text-doqyn-text">
              {name}
            </TruncatedText>
            <BadgeGroup className="mt-1.5">
              <StatusPill
                status={(document.status as DocumentStatus) ?? 'active'}
                size="xs"
                dot
              />
              <DocumentFavoriteBadge document={document} variant="inline" />
            </BadgeGroup>
            <dl className="mt-2 border-t border-doqyn-border-subtle/70 pt-2">
              <DetailRow
                label="Categoria"
                value={document.categoryName ?? document.documentType ?? '—'}
              />
              <DetailRow
                label="Proprietário"
                value={document.createdBy?.displayName ?? document.ownerName ?? '—'}
              />
              <DetailRow label="Atualizado" value={formatDate(document.updatedAt)} />
              {document.processingStatus && (
                <DetailRow label="Processamento" value={document.processingStatus} />
              )}
              {fileSizeLabel && <DetailRow label="Tamanho" value={fileSizeLabel} />}
            </dl>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="rounded-xl border border-doqyn-border-subtle bg-doqyn-bg/40 p-4"
      data-testid="update-version-current-summary"
    >
      <p className="mb-3 text-[12px] font-medium text-doqyn-text">Documento atual</p>
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
              <dt className="text-doqyn-muted">Categoria</dt>
              <dd className="text-doqyn-text">
                {document.categoryName ?? document.documentType ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-doqyn-muted">Proprietário</dt>
              <dd className="text-doqyn-text">
                {document.createdBy?.displayName ?? document.ownerName ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-doqyn-muted">Criado</dt>
              <dd className="text-doqyn-text">{formatDate(document.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-doqyn-muted">Atualizado</dt>
              <dd className="text-doqyn-text">{formatDate(document.updatedAt)}</dd>
            </div>
            <div>
              <dt className="text-doqyn-muted">Processamento</dt>
              <dd className="text-doqyn-text">{document.processingStatus ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-doqyn-muted">Tipo / tamanho</dt>
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
