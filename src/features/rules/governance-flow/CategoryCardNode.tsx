import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Icon } from '@/components/ui/Icon';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { CategoryIcon } from '../components/categoryIcons';
import { GovernancePermissionBadges } from '../components/governance/GovernancePermissionBadges';
import { getCategoryAccentColor } from '../utils/governanceMapUi';
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
    connectedLinks,
    hasExtractionConfig,
    selected,
    highlighted,
    dimmed,
    connectMode,
    connectGroupName,
    isAdmin,
    onSelect,
    onOpenConnection,
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
          'governance-category-card w-full',
          selected && 'border-doqyn-border-strong ring-1 ring-doqyn-primary/25',
          highlighted && !selected && 'border-doqyn-border-strong bg-doqyn-card/70',
          connectMode && 'border-dashed border-doqyn-primary/50 bg-doqyn-primary-bg/30',
          dimmed && 'opacity-35',
        )}
        style={accentColor ? { borderLeftColor: accentColor } : undefined}
      >
        <button
          type="button"
          onClick={onSelect}
          className="w-full p-3 text-left focus:outline-none"
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-doqyn-border-subtle bg-doqyn-surface"
              style={accentColor ? { color: accentColor } : undefined}
            >
              <CategoryIcon icon={category.icon} className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="truncate text-sm font-semibold text-doqyn-text">{category.name}</p>
                {hasExtractionConfig && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-doqyn-info-bg px-1.5 py-0.5 text-[9px] font-medium text-doqyn-info">
                    <Icon name="auto_awesome" size={10} aria-hidden />
                    Análise
                  </span>
                )}
              </div>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-doqyn-muted">
                {category.description || 'Categoria documental'}
              </p>
              <p className="mt-1.5 text-[10px] font-medium text-doqyn-subtle">
                {connectedGroupCount}{' '}
                {connectedGroupCount === 1 ? 'grupo com acesso' : 'grupos com acesso'}
              </p>
              {connectedLinks.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {connectedLinks.slice(0, 3).map((link) => (
                    <li key={link.groupId}>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenConnection(link.groupId);
                        }}
                        className="nodrag flex w-full items-center justify-between gap-2 rounded-md border border-doqyn-border-subtle bg-doqyn-bg/50 px-2 py-1 text-left hover:bg-doqyn-surface-hover"
                      >
                        <span className="truncate text-[10px] font-medium text-doqyn-text">
                          {link.groupName}
                        </span>
                        <GovernancePermissionBadges permissions={link.permissions} />
                      </button>
                    </li>
                  ))}
                  {connectedLinks.length > 3 && (
                    <li className="px-1 text-[10px] text-doqyn-subtle">
                      +{connectedLinks.length - 3} grupos
                    </li>
                  )}
                </ul>
              )}
              {connectMode && (
                <p className="mt-2 rounded-md bg-doqyn-primary-bg px-2 py-1.5 text-[11px] font-medium text-doqyn-primary">
                  Clique para conectar {connectGroupName ? `"${connectGroupName}"` : 'o grupo'} aqui
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
