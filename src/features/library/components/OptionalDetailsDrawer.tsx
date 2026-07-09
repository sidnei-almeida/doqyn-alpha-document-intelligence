import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { buttonVariants } from '@/components/ui/buttonVariants';
import { StatusPill } from '@/components/ui/StatusPill';
import { VersionBadge } from '@/components/ui/VersionBadge';
import { cn, formatDate } from '@/lib/utils';
import { ICON_SIZE } from '@/lib/iconDefaults';
import type { DocumentStatus } from '@/types/document';
import type { DocumentListItem } from '@/types/document-library';
import { getFolderAccentColor } from '../utils/folderColors';
import type { LibrarySelection } from '../types/library';
import { DocumentVersionHistoryPanel } from './DocumentVersionHistoryPanel';
import { DocumentFileThumbnail } from './files/DocumentFileThumbnail';
import { DocumentFavoriteBadge } from './files/DocumentFavoriteBadge';
import { TruncatedText } from '@/components/ui/TruncatedText';

type OptionalDetailsDrawerProps = {
  selection: LibrarySelection;
  onClose: () => void;
  onPreview: (doc: DocumentListItem) => void;
  onDownload: (doc: DocumentListItem) => void;
  onUpdateDocument?: (doc: DocumentListItem) => void;
  onPreviewVersion?: (doc: DocumentListItem, versionId: string) => void;
};

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="shrink-0 text-[11px] text-doqyn-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right text-[11px] text-doqyn-text">{children}</dd>
    </div>
  );
}

function FileDetailsBody({
  doc,
  onPreview,
  onDownload,
  onUpdateDocument,
  onPreviewVersion,
}: {
  doc: DocumentListItem;
  onPreview: (doc: DocumentListItem) => void;
  onDownload: (doc: DocumentListItem) => void;
  onUpdateDocument?: (doc: DocumentListItem) => void;
  onPreviewVersion?: (doc: DocumentListItem, versionId: string) => void;
}) {
  const name = doc.currentFileName ?? doc.displayName;
  const canPreview = doc.permissions?.canPreview !== false && Boolean(doc.latestVersionId);
  const canDownload = Boolean(doc.permissions?.canDownload && doc.latestVersionId);
  const canTracking = Boolean(doc.permissions?.canViewTracking);
  const canUpdate = Boolean(doc.permissions?.canUpdate);

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
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <StatusPill status={(doc.status as DocumentStatus) ?? 'active'} className="scale-90" />
              <VersionBadge
                version={doc.currentVersionLabel ?? doc.versionLabel ?? `v${doc.version}`}
                isCurrent
              />
            </div>
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
      </div>

      <dl className="divide-y divide-doqyn-border-subtle border-t border-doqyn-border-subtle">
        <DetailField label="Categoria">{doc.categoryName ?? doc.documentType ?? '—'}</DetailField>
        <DetailField label="Proprietário">
          {doc.createdBy?.displayName ?? doc.ownerName ?? '—'}
        </DetailField>
        <DetailField label="Atualizado">{formatDate(doc.updatedAt)}</DetailField>
        <DetailField label="Criado">{formatDate(doc.createdAt)}</DetailField>
        <DetailField label="Versão">
          <VersionBadge
            version={doc.currentVersionLabel ?? doc.versionLabel ?? `v${doc.version}`}
            isCurrent
          />
        </DetailField>
      </dl>
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

import type { LibraryFolder } from '../types/library';

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
}: OptionalDetailsDrawerProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!selection) return null;

  const title = selection.kind === 'file' ? 'Detalhes do arquivo' : 'Detalhes da pasta';

  return (
    <div
      className="fixed inset-0 z-[85] flex justify-end modal-overlay-scrim backdrop-blur-[1px]"
      role="presentation"
      data-testid="library-details-drawer-overlay"
      onClick={onClose}
    >
      <aside
        className="drawer-enter-right flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-doqyn-border-subtle bg-doqyn-surface shadow-dropdown"
        aria-label={title}
        data-testid="library-details-drawer"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-doqyn-border-subtle px-4 py-3">
          <p className="text-[12px] font-semibold text-doqyn-text">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="explorer-icon-btn"
            aria-label="Fechar painel de detalhes"
            data-testid="library-details-drawer-close"
          >
            <Icon name="close" size={ICON_SIZE.sm} />
          </button>
        </div>

        <div
          className={cn(
            'min-h-0 flex-1 px-4 py-3',
            selection.kind === 'file'
              ? 'flex flex-col overflow-hidden'
              : 'scrollbar-thin overflow-y-auto',
          )}
        >
          {selection.kind === 'file' && (
            <FileDetailsBody
              doc={selection.document}
              onPreview={onPreview}
              onDownload={onDownload}
              onUpdateDocument={onUpdateDocument}
              onPreviewVersion={onPreviewVersion}
            />
          )}
          {selection.kind === 'folder' && <FolderDetailsBody folder={selection.folder} />}
        </div>
      </aside>
    </div>
  );
}
