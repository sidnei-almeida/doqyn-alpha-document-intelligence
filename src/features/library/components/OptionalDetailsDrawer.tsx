import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { buttonVariants } from '@/components/ui/buttonVariants';
import { StatusPill } from '@/components/ui/StatusPill';
import { VersionBadge } from '@/components/ui/VersionBadge';
import { FileTypeIcon } from '@/components/ui/FileTypeIcon';
import { formatDate } from '@/lib/utils';
import { ICON_SIZE } from '@/lib/iconDefaults';
import type { DocumentStatus } from '@/types/document';
import type { DocumentListItem } from '@/types/document-library';
import { getFolderAccentColor } from '../utils/folderColors';
import type { LibrarySelection } from '../types/library';

type OptionalDetailsDrawerProps = {
  selection: LibrarySelection;
  onClose: () => void;
  onPreview: (doc: DocumentListItem) => void;
  onDownload: (doc: DocumentListItem) => void;
};

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="shrink-0 text-[12px] text-doqyn-subtle">{label}</dt>
      <dd className="min-w-0 text-right text-[12px] text-doqyn-text">{children}</dd>
    </div>
  );
}

function FileDetailsBody({
  doc,
  onPreview,
  onDownload,
}: {
  doc: DocumentListItem;
  onPreview: (doc: DocumentListItem) => void;
  onDownload: (doc: DocumentListItem) => void;
}) {
  const name = doc.currentFileName ?? doc.displayName;
  const canPreview = doc.permissions?.canPreview !== false && Boolean(doc.latestVersionId);
  const canDownload = Boolean(doc.permissions?.canDownload && doc.latestVersionId);
  const canTracking = Boolean(doc.permissions?.canViewTracking);

  return (
    <>
      <div className="flex items-start gap-3 border-b border-doqyn-border-subtle pb-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-doqyn-card">
          <FileTypeIcon fileName={name} className="h-5 w-5 text-doqyn-muted" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-words text-[14px] font-medium leading-snug text-doqyn-text">{name}</p>
          <div className="mt-2">
            <StatusPill status={(doc.status as DocumentStatus) ?? 'active'} className="scale-90" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 py-4">
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
      </div>

      <dl className="divide-y divide-doqyn-border-subtle border-t border-doqyn-border-subtle">
        <DetailField label="Categoria">{doc.categoryName ?? doc.documentType ?? '—'}</DetailField>
        <DetailField label="Proprietário">
          {doc.createdBy?.displayName ?? doc.ownerName ?? '—'}
        </DetailField>
        <DetailField label="Atualizado">{formatDate(doc.updatedAt)}</DetailField>
        <DetailField label="Criado">{formatDate(doc.createdAt)}</DetailField>
        <DetailField label="Versão">
          <VersionBadge version={doc.versionLabel ?? `v${doc.version}`} isCurrent />
        </DetailField>
      </dl>
    </>
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
        className="drawer-enter-right flex h-full w-full max-w-[var(--library-details-width)] flex-col overflow-y-auto border-l border-doqyn-border-subtle bg-doqyn-surface shadow-dropdown scrollbar-thin"
        aria-label={title}
        data-testid="library-details-drawer"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-doqyn-border-subtle px-4 py-3">
          <p className="text-[13px] font-medium text-doqyn-text">{title}</p>
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

        <div className="flex-1 px-4 py-4">
          {selection.kind === 'file' && (
            <FileDetailsBody doc={selection.document} onPreview={onPreview} onDownload={onDownload} />
          )}
          {selection.kind === 'folder' && <FolderDetailsBody folder={selection.folder} />}
        </div>
      </aside>
    </div>
  );
}
