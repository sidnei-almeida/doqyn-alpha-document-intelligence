import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { useTranslation } from 'react-i18next';

type DocumentItemMenuProps = {
  label: string;
  onOpen: (x: number, y: number) => void;
  className?: string;
};

/** Menu ⋮ discreto para cards e linhas de arquivo. */
export function DocumentItemMenu({ label, onOpen, className }: DocumentItemMenuProps) {
  const { t } = useTranslation('library');

  return (
    <button
      type="button"
      className={className}
      aria-label={t('item.menu', { name: label })}
      data-no-marquee-select
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
