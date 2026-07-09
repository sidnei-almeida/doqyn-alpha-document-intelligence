import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';

type DocumentItemMenuProps = {
  label: string;
  onOpen: (x: number, y: number) => void;
  className?: string;
};

/** Menu ⋮ discreto para cards e linhas de arquivo. */
export function DocumentItemMenu({ label, onOpen, className }: DocumentItemMenuProps) {
  return (
    <button
      type="button"
      className={className}
      aria-label={`Menu de ${label}`}
      onClick={(event) => {
        event.stopPropagation();
        const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
        onOpen(rect.left, rect.bottom);
      }}
    >
      <Icon name="more_horiz" size={ICON_SIZE.sm} />
    </button>
  );
}
