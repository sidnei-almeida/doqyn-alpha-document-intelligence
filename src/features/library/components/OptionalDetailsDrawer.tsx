import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { BadgeGroup } from '@/components/ui/BadgeGroup';
import { buttonVariants } from '@/components/ui/buttonVariants';
import { StatusPill } from '@/components/ui/StatusPill';
import { VersionBadge } from '@/components/ui/VersionBadge';
import { WorkspaceSideDrawer } from '@/components/layout/WorkspaceSideDrawer';
import { ICON_SIZE } from '@/lib/iconDefaults';
import type { DocumentStatus } from '@/types/document';
import type { DocumentListItem } from '@/types/document-library';
import { getFolderAccentColor } from '../utils/folderColors';
import type { LibraryFolder, LibrarySelection } from '../types/library';
import { DocumentVersionHistoryPanel } from './DocumentVersionHistoryPanel';
import { DocumentFileThumbnail } from './files/DocumentFileThumbnail';
import { DocumentFavoriteBadge } from './files/DocumentFavoriteBadge';
import { DocumentSignatureBadge } from './files/DocumentSignatureBadge';
import { signatureDetailSummaryText } from '@/features/signature/utils/signatureSummaryDisplay';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { useDocumentDetail } from '@/features/documents/hooks/useDocuments';
import {
  DocumentDetailField,
  DocumentStandardFicha,
  DocumentSystemDetails,
} from '@/features/documents/components/DocumentDetailsShared';

type OptionalDetailsDrawerProps = {
  selection: LibrarySelection;
  onClose: () => void;
  onPreview: (doc: DocumentListItem) => void;
  onDownload: (doc: DocumentListItem) => void;
  onUpdateDocument?: (doc: DocumentListItem) => void;
  onPreviewVersion?: (doc: DocumentListItem, versionId: string) => void;
  onViewSignatures?: (doc: DocumentListItem) => void;
  onDownloadSignedPdf?: (doc: DocumentListItem) => void;
  onTransferOwnership?: (doc: DocumentListItem) => void;
};

function FileDetailsBody({
  doc,
  onPreview,
  onDownload,
  onUpdateDocument,
  onPreviewVersion,
  onViewSignatures,
  onDownloadSignedPdf,
  onTransferOwnership,
}: {
  doc: DocumentListItem;
  onPreview: (doc: DocumentListItem) => void;
  onDownload: (doc: DocumentListItem) => void;
  onUpdateDocument?: (doc: DocumentListItem) => void;
  onPreviewVersion?: (doc: DocumentListItem, versionId: string) => void;
  onViewSignatures?: (doc: DocumentListItem) => void;
  onDownloadSignedPdf?: (doc: DocumentListItem) => void;
  onTransferOwnership?: (doc: DocumentListItem) => void;
}) {
  const name = doc.currentFileName ?? doc.displayName;
  const canPreview = doc.permissions?.canPreview !== false && Boolean(doc.latestVersionId);
  const canDownload = Boolean(doc.permissions?.canDownload && doc.latestVersionId);
  const canTracking = Boolean(doc.permissions?.canViewTracking);
  const canUpdate = Boolean(doc.permissions?.canUpdate);
  const canTransferOwnership = Boolean(doc.permissions?.canTransferOwnership && onTransferOwnership);
  const hasSignatureActivity =
    doc.signatureSummary?.status && doc.signatureSummary.status !== 'none';
  const canDownloadSignedPdf = Boolean(
    doc.signatureSummary?.hasSignedPdf && onDownloadSignedPdf,
  );
  const verificationCode = doc.signatureSummary?.verificationCode;

  const { data: detail, isLoading: detailLoading } = useDocumentDetail(doc.documentId);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0">
        <div className="flex gap-3 border-b border-doqyn-border-subtle pb-3">
          <div className="relative w-[108px] shrink-0">
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg border border-doqyn-border-subtle bg-doqyn-thumbnail-chrome [&_img]:object-contain [&_img]:object-top">
              <DocumentFileThumbnail document={doc} size="card" className="absolute inset-0 h-full w-full" />
              <DocumentFavoriteBadge document={doc} variant="overlay" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <TruncatedText className="text-[13px] font-medium leading-snug text-doqyn-text">
              {name}
            </TruncatedText>
            <BadgeGroup className="mt-1.5">
              <StatusPill status={(doc.status as DocumentStatus) ?? 'active'} size="xs" dot />
              <VersionBadge
                version={doc.currentVersionLabel ?? doc.versionLabel ?? `v${doc.version}`}
                isCurrent
                size="xs"
              />
              <DocumentSignatureBadge
                summary={doc.signatureSummary}
                size="xs"
                onClick={onViewSignatures ? () => onViewSignatures(doc) : undefined}
              />
            </BadgeGroup>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 py-3">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!canPreview}
            onClick={() => onPreview(doc)}
          >
            <Icon name="visibility" size={ICON_SIZE.sm} />
            Visualizar
          </Button>
          {canDownload && (
            <Button type="button" size="sm" variant="secondary" onClick={() => onDownload(doc)}>
              <Icon name="download" size={ICON_SIZE.sm} />
              Baixar
            </Button>
          )}
          {canTracking && (
            <Link
              to={`/tracking?documentId=${encodeURIComponent(doc.documentId)}`}
              className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            >
              <Icon name="history" size={ICON_SIZE.sm} />
              Tracking
            </Link>
          )}
          {canUpdate && onUpdateDocument && (
            <Button type="button" size="sm" variant="secondary" onClick={() => onUpdateDocument(doc)}>
              <Icon name="upload" size={ICON_SIZE.sm} />
              Atualizar documento
            </Button>
          )}
          {canTransferOwnership && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onTransferOwnership?.(doc)}
            >
              <Icon name="person" size={ICON_SIZE.sm} />
              Transferir propriedade
            </Button>
          )}
        </div>

        <DocumentSystemDetails document={detail?.document ?? doc} />

        <dl className="divide-y divide-doqyn-border-subtle border-t border-doqyn-border-subtle">
          <DocumentDetailField label="Versão">
            <VersionBadge
              version={doc.currentVersionLabel ?? doc.versionLabel ?? `v${doc.version}`}
              isCurrent
            />
          </DocumentDetailField>
        </dl>

        {detailLoading ? (
          <p className="py-2 text-[11px] text-doqyn-muted">Carregando ficha…</p>
        ) : (
          <div className="py-2">
            <DocumentStandardFicha metadata={detail?.metadata} searchMeta={detail?.searchMeta} />
          </div>
        )}

        <div className="border-t border-doqyn-border-subtle py-3">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-doqyn-muted">
            Assinatura
          </p>
          <p className="text-[12px] leading-relaxed text-doqyn-subtle">
            {signatureDetailSummaryText(doc.signatureSummary)}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {hasSignatureActivity && onViewSignatures ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => onViewSignatures(doc)}
              >
                Ver assinaturas
              </Button>
            ) : null}
            {canDownloadSignedPdf ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => onDownloadSignedPdf?.(doc)}
                data-testid="details-download-signed-pdf"
              >
                Baixar PDF assinado
              </Button>
            ) : null}
            {verificationCode ? (
              <Link
                to={`/verify/signature/${encodeURIComponent(verificationCode)}`}
                className={buttonVariants({ variant: 'ghost', size: 'sm' })}
              >
                Abrir validador
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col border-t border-doqyn-border-subtle pt-3">
        <p className="mb-2 shrink-0 text-[10px] font-medium uppercase tracking-wide text-doqyn-muted">
          Histórico de versões
        </p>
        <DocumentVersionHistoryPanel
          document={doc}
          fillHeight
          onPreviewVersion={
            onPreviewVersion ? (versionId) => onPreviewVersion(doc, versionId) : undefined
          }
        />
      </div>
    </div>
  );
}

function FolderDetailsBody({ folder }: { folder: LibraryFolder }) {
  const accent = getFolderAccentColor(folder.name);
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-doqyn-card">
          <Icon name="folder" filled color={accent} size={ICON_SIZE.md} />
        </span>
        <div>
          <p className="text-[14px] font-medium text-doqyn-text">{folder.name}</p>
          {folder.description && (
            <p className="mt-1 text-[12px] leading-relaxed text-doqyn-muted">
              {folder.description}
            </p>
          )}
        </div>
      </div>
      <dl className="space-y-2 border-t border-doqyn-border-subtle pt-3 text-[12px]">
        <div className="flex justify-between gap-4">
          <dt className="text-doqyn-subtle">Tipo</dt>
          <dd className="text-doqyn-text">Categoria inteligente</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-doqyn-subtle">Arquivos</dt>
          <dd className="text-doqyn-text">
            {folder.documentCount}{' '}
            {folder.documentCount === 1 ? 'arquivo' : 'arquivos'}
          </dd>
        </div>
      </dl>
      <Link
        to="/rules"
        className="inline-flex items-center gap-1.5 text-[12px] text-doqyn-muted hover:text-doqyn-text hover:underline"
      >
        Ver regras desta categoria
      </Link>
    </div>
  );
}

/** Drawer lateral opcional — só aparece quando o usuário pede detalhes. */
export function OptionalDetailsDrawer({
  selection,
  onClose,
  onPreview,
  onDownload,
  onUpdateDocument,
  onPreviewVersion,
  onViewSignatures,
  onDownloadSignedPdf,
  onTransferOwnership,
}: OptionalDetailsDrawerProps) {
  if (!selection) return null;

  const title = selection.kind === 'file' ? 'Detalhes do arquivo' : 'Detalhes da pasta';

  return (
    <WorkspaceSideDrawer
      title={title}
      onClose={onClose}
      testId="library-details-drawer"
      overlayTestId="library-details-drawer-overlay"
      closeTestId="library-details-drawer-close"
      closeAriaLabel="Fechar painel de detalhes"
      scrollable={selection.kind !== 'file'}
      bodyClassName={selection.kind === 'file' ? 'flex flex-col overflow-hidden' : undefined}
    >
      {selection.kind === 'file' && (
        <FileDetailsBody
          doc={selection.document}
          onPreview={onPreview}
          onDownload={onDownload}
          onUpdateDocument={onUpdateDocument}
          onPreviewVersion={onPreviewVersion}
          onViewSignatures={onViewSignatures}
          onDownloadSignedPdf={onDownloadSignedPdf}
          onTransferOwnership={onTransferOwnership}
        />
      )}
      {selection.kind === 'folder' && <FolderDetailsBody folder={selection.folder} />}
    </WorkspaceSideDrawer>
  );
}
