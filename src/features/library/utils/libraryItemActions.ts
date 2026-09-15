import type { DocumentListItem } from '@/types/document-library';
export { uploadStatusProgress } from '@/features/upload/utils/uploadStatusProgress';

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
  onMove?: (doc: DocumentListItem) => void;
  onShare?: (doc: DocumentListItem) => void;
  onRequestSignature?: (doc: DocumentListItem) => void;
  onTrash?: (doc: DocumentListItem) => void;
};

export function buildFileItemActions(
  doc: DocumentListItem,
  handlers: FileItemActionHandlers,
): Array<{
  labelKey: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
  hidden?: boolean;
}> {
  const canPreview = doc.permissions?.canPreview !== false && Boolean(doc.latestVersionId);
  const canDownload = Boolean(doc.permissions?.canDownload && doc.latestVersionId);
  const canTracking = Boolean(doc.permissions?.canViewTracking);

  return [
    {
      labelKey: 'library:itemAction.abrir',
      onClick: () => handlers.onOpen(doc),
      hidden: !canPreview,
    },
    {
      labelKey: 'library:itemAction.visualizar',
      onClick: () => handlers.onPreview(doc),
      hidden: !canPreview,
    },
    {
      labelKey: 'library:itemAction.moverParaPasta',
      onClick: () => handlers.onMove?.(doc),
      hidden: !handlers.onMove,
    },
    {
      labelKey: 'library:itemAction.compartilhar',
      onClick: () => handlers.onShare?.(doc),
      hidden: !handlers.onShare,
    },
    {
      labelKey: 'library:itemAction.solicitarAssinatura',
      onClick: () => handlers.onRequestSignature?.(doc),
      hidden: !handlers.onRequestSignature,
    },
    {
      labelKey: 'library:itemAction.baixar',
      onClick: () => handlers.onDownload(doc),
      hidden: !canDownload,
    },
    {
      labelKey: 'library:itemAction.historicoDeVersoes',
      onClick: () => handlers.onTracking(doc),
      hidden: !canTracking,
    },
    {
      labelKey: 'library:itemAction.moverParaLixeira',
      onClick: () => handlers.onTrash?.(doc),
      tone: 'danger' as const,
      hidden: !handlers.onTrash,
    },
  ];
}
