import { cn } from '@/lib/utils';
import type { DocumentCategory } from '@/types/rules';
import { CategoryIcon } from '../categoryIcons';

export const DEFAULT_CATEGORY_COLOR = 'var(--folder-accent-default)';

/**
 * Glifo da categoria — o mesmo em toda a governança.
 *
 * Estava duplicado no card e na matriz, com a constante de cor redeclarada nos dois:
 * mudar o tamanho num lugar deixava o outro para trás.
 */
export function CategoryGlyph({
  category,
  size = 'md',
  className,
}: {
  category: DocumentCategory;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const color = category.color || DEFAULT_CATEGORY_COLOR;
  return (
    <span
      className={cn('category-glyph', size === 'sm' && 'category-glyph--sm', className)}
      style={{
        background: `color-mix(in srgb, ${color} 16%, var(--bg-surface-2))`,
        color,
      }}
      aria-hidden
    >
      <CategoryIcon icon={category.icon} size={size === 'sm' ? 14 : 18} />
    </span>
  );
}
