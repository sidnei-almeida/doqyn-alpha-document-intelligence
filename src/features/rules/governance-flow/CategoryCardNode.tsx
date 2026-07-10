import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Icon } from '@/components/ui/Icon';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { CategoryIcon } from '../components/categoryIcons';
import { getCategoryAccentColor } from '../utils/governanceMapUi';
import { isDocumentCategoryId } from '@/lib/entityIds';
import type { CategoryFlowNode } from './types';

function blurUnlessFocusWithin(event: React.FocusEvent<HTMLElement>, onBlur: () => void) {
  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
    onBlur();
  }
}

/** Node do React Flow para categoria documental — origem das conexões de acesso. */
export const CategoryCardNode = memo(function CategoryCardNode({
  data,
}: NodeProps<CategoryFlowNode>) {
  const {
    category,
    connectedGroupCount,
    hasExtractionConfig,
    selected,
    highlighted,
    dimmed,
    connectMode,
    connectGroupName,
    isAdmin,
    onSelect,
    onHoverStart,
    onHoverEnd,
  } = data;

  const accentColor = getCategoryAccentColor(category.name);

  return (
    <div
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onFocusCapture={onHoverStart}
      onBlurCapture={(event) => blurUnlessFocusWithin(event, onHoverEnd)}
      className="relative"
    >
      <Card
        variant="interactive"
        className={cn(
          'governance-flow-card governance-flow-card--interactive w-full border',
          selected && 'border-doqyn-border-strong ring-1 ring-doqyn-primary/20',
          highlighted && !selected && 'border-doqyn-border-strong',
          connectMode && 'border-dashed border-doqyn-primary/40 ring-1 ring-doqyn-primary/15',
          dimmed && 'opacity-55 saturate-75',
        )}
      >
        <button
          type="button"
          onClick={onSelect}
          className="w-full p-3.5 text-left focus:outline-none"
        >
          <div className="flex items-start gap-3">
            <span className="governance-flow-icon-chip flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
              <CategoryIcon
                icon={category.icon}
                filled
                size={ICON_SIZE.md}
                color={accentColor ?? 'var(--folder-accent-default)'}
              />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="truncate text-sm font-semibold text-doqyn-text">{category.name}</p>
                <span className="rounded-full border border-doqyn-border bg-doqyn-card px-1.5 py-0.5 text-[10px] font-medium text-doqyn-subtle">
                  Classe
                </span>
                {isDocumentCategoryId(category.id) && (
                  <span className="max-w-[9rem] truncate rounded-full bg-doqyn-surface px-1.5 py-0.5 font-mono text-[10px] text-doqyn-muted">
                    {category.id}
                  </span>
                )}
                {hasExtractionConfig && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-doqyn-info-bg px-2 py-0.5 text-[10px] font-medium text-doqyn-info">
                    <Icon name="auto_awesome" size={11} aria-hidden />
                    Análise
                  </span>
                )}
              </div>
              <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-doqyn-muted">
                {category.description || 'Categoria documental'}
              </p>
              <p className="mt-2 text-[11px] text-doqyn-subtle">
                {connectedGroupCount === 0
                  ? 'Nenhum grupo conectado ainda'
                  : `${connectedGroupCount} ${
                      connectedGroupCount === 1 ? 'grupo com acesso' : 'grupos com acesso'
                    }`}
              </p>
              {connectMode && (
                <p className="mt-2 rounded-lg border border-doqyn-primary/20 bg-doqyn-primary-bg/20 px-2.5 py-1.5 text-[11px] text-doqyn-primary">
                  Clique para conectar {connectGroupName ? `"${connectGroupName}"` : 'o grupo'}
                </p>
              )}
            </div>
          </div>
        </button>
      </Card>
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isAdmin}
        className="governance-flow-handle governance-flow-handle--source"
        style={accentColor ? { backgroundColor: accentColor } : undefined}
        aria-label={`Conector de origem da categoria ${category.name}`}
      />
    </div>
  );
});
