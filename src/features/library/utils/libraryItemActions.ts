import type { DocumentListItem } from '@/types/document-library';
import type { UploadQueueItemStatus } from '@/features/upload/types';

export function uploadStatusProgress(status: UploadQueueItemStatus): number {
  switch (status) {
    case 'queued':
      return 12;
    case 'analyzing':
      return 48;
    case 'review':
      return 72;
    case 'confirming':
      return 88;
    case 'done':
      return 100;
    case 'error':
      return 100;
    default:
      return 0;
  }
}

export function truncateBreadcrumbLabel(label: string, maxLength = 28): string {
  if (label.length <= maxLength) return label;
  const edge = Math.floor((maxLength - 1) / 2);
  return `${label.slice(0, edge)}…${label.slice(-edge)}`;
}

export function buildLibraryBreadcrumbSegments(input: {
  collectionLabel?: string;
  spaceName?: string;
  isRootCollection: boolean;
}): Array<{ label: string; key: string }> {
  const segments: Array<{ label: string; key: string }> = [];

  if (!input.isRootCollection && input.collectionLabel) {
    segments.push({ key: 'collection', label: input.collectionLabel });
  }

  if (input.spaceName) {
    segments.push({ key: 'space', label: input.spaceName });
  }

  return segments;
}

export type FileItemActionHandlers = {
  onOpen: (doc: DocumentListItem) => void;
  onPreview: (doc: DocumentListItem) => void;
  onDownload: (doc: DocumentListItem) => void;
  onTracking: (doc: DocumentListItem) => void;
  onRename?: (doc: DocumentListItem) => void;
  onMove?: (doc: DocumentListItem) => void;
  onShare?: (doc: DocumentListItem) => void;
  onTrash?: (doc: DocumentListItem) => void;
};

export function buildFileItemActions(
  doc: DocumentListItem,
  handlers: FileItemActionHandlers,
): Array<{
  label: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
  hidden?: boolean;
}> {
  const canPreview = doc.permissions?.canPreview !== false && Boolean(doc.latestVersionId);
  const canDownload = Boolean(doc.permissions?.canDownload && doc.latestVersionId);
  const canTracking = Boolean(doc.permissions?.canViewTracking);

  return [
    { label: 'Abrir', onClick: () => handlers.onOpen(doc), hidden: !canPreview },
    { label: 'Visualizar', onClick: () => handlers.onPreview(doc), hidden: !canPreview },
    { label: 'Renomear', onClick: () => handlers.onRename?.(doc), hidden: !handlers.onRename },
    { label: 'Mover para pasta', onClick: () => handlers.onMove?.(doc), hidden: !handlers.onMove },
    { label: 'Compartilhar', onClick: () => handlers.onShare?.(doc), hidden: !handlers.onShare },
    { label: 'Baixar', onClick: () => handlers.onDownload(doc), hidden: !canDownload },
    {
      label: 'Histórico de versões',
      onClick: () => handlers.onTracking(doc),
      hidden: !canTracking,
    },
    {
      label: 'Mover para lixeira',
      onClick: () => handlers.onTrash?.(doc),
      tone: 'danger' as const,
      hidden: !handlers.onTrash,
    },
  ];
}
