import { Icon } from '@/components/ui/Icon';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { ICON_SIZE } from '@/lib/iconDefaults';
import type { DocumentListItem } from '@/types/document-library';

type UpdateDocumentVersionHeaderProps = {
  documentItem: DocumentListItem;
  currentVersionLabel: string;
  nextVersionLabel: string;
  onClose: () => void;
};

export function UpdateDocumentVersionHeader({
  documentItem,
  currentVersionLabel,
  nextVersionLabel,
  onClose,
}: UpdateDocumentVersionHeaderProps) {
  const name = documentItem.currentFileName ?? documentItem.displayName;

  return (
    <div className="flex shrink-0 items-start justify-between gap-3 border-b border-doqyn-border-subtle px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-wide text-doqyn-primary">
          Atualizar documento
        </p>
        <TruncatedText
          as="h2"
          id="update-document-version-title"
          className="mt-0.5 text-[15px] font-semibold leading-snug text-doqyn-text"
        >
          {`Nova versão de ${name}`}
        </TruncatedText>
        <p className="mt-1 text-[11px] text-doqyn-muted">
          {currentVersionLabel} → {nextVersionLabel}
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="explorer-icon-btn shrink-0"
        aria-label="Fechar atualização de versão"
        data-testid="update-version-drawer-close"
      >
        <Icon name="close" size={ICON_SIZE.sm} />
      </button>
    </div>
  );
}
