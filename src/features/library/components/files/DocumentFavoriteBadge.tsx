import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import type { DocumentListItem } from '@/types/document-library';
import { useDocumentIsFavorite } from '../../hooks/useDocumentIsFavorite';

type DocumentFavoriteBadgeProps = {
  document: DocumentListItem;
  /** overlay = canto do preview; inline = ao lado do nome. */
  variant?: 'overlay' | 'inline';
  className?: string;
};

/** Estrela persistente — só para o usuário que favoritou (preferência pessoal). */
export function DocumentFavoriteBadge({
  document,
  variant = 'inline',
  className,
}: DocumentFavoriteBadgeProps) {
  const isFavorite = useDocumentIsFavorite(document);
  if (!isFavorite) return null;

  if (variant === 'overlay') {
    return (
      <span
        className={cn('document-favorite-badge pointer-events-none absolute bottom-1.5 left-1.5 z-10', className)}
        title="Favorito"
        aria-hidden
      >
        <Icon name="star" filled size={ICON_SIZE.xs} className="text-doqyn-warning" />
      </span>
    );
  }

  return (
    <Icon
      name="star"
      filled
      size={ICON_SIZE.xs}
      className={cn('shrink-0 text-doqyn-warning', className)}
      aria-label="Favorito"
    />
  );
}
