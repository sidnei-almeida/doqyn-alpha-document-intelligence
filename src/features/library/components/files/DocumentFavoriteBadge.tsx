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

/**
 * Marca de favorito — estrela cheia, sem disco em volta e sem cor de estado.
 * O disco desenhava uma bolha escura sobre a folha branca da miniatura, e o
 * âmbar dizia "alerta" para uma preferência pessoal. O que distingue a marca
 * agora é a forma: tudo no sistema é ícone de traço, só o favorito é cheio.
 */
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
        <Icon name="star" filled size={ICON_SIZE.xs} />
      </span>
    );
  }

  return (
    <Icon
      name="star"
      filled
      size={ICON_SIZE.xs}
      className={cn('shrink-0 text-doqyn-text', className)}
      aria-label="Favorito"
    />
  );
}
