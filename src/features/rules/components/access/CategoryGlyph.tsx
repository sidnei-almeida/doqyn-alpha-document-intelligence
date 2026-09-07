import { cn } from '@/lib/utils';
import type { DocumentCategory } from '@/types/rules';
import { CategoryIcon } from '../categoryIcons';

export const DEFAULT_CATEGORY_COLOR = 'var(--folder-accent-default)';

/**
 * Glifo da categoria — o mesmo em toda a governança.
 *
 * A placa colorida saiu: caixa cheia é linguagem do Drive, e repetida em cada faixa virava um
 * mostruário de cores. A cor continua identificando a categoria, agora no traço do ícone — o
 * mesmo tratamento que a Biblioteca já dá às pastas em `ExplorerFolderCard`.
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
      aria-hidden
    >
      <CategoryIcon icon={category.icon} size={size === 'sm' ? 16 : 20} color={color} />
    </span>
  );
}
