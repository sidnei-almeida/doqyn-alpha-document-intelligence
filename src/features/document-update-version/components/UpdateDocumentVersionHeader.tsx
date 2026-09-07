import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
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
    <div className="flex shrink-0 items-start justify-between gap-3 border-b border-doqyn-border-subtle px-5 py-4">
      <div className="min-w-0 flex-1">
        {/* O eyebrow era acento: acento significa interativo, e um rótulo de
            seção não é clicável. */}
        <p className="register-label text-doqyn-subtle">Atualizar documento</p>
        <TruncatedText
          as="h2"
          id="update-document-version-title"
          className="type-h2 mt-1 text-doqyn-text"
        >
          {`Nova versão de ${name}`}
        </TruncatedText>
        <p className="mt-1 font-mono text-micro tabular-nums text-doqyn-subtle">
          {currentVersionLabel} → {nextVersionLabel}
        </p>
      </div>
      <IconButton
        label="Fechar atualização de versão"
        onClick={onClose}
        data-testid="update-version-drawer-close"
      >
        <Icon name="close" size={ICON_SIZE.sm} />
      </IconButton>
    </div>
  );
}
