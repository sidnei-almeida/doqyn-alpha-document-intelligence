import { memo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AnchoredPopover } from '@/components/ui/popover/AnchoredPopover';
import { cn } from '@/lib/utils';
import { GROUP_COLOR_STYLES, getInitials } from '@/utils/rulesHelpers';
import { isDocumentGroupId } from '@/lib/entityIds';
import { GovernancePermissionBadges } from '../components/governance/GovernancePermissionBadges';
import type { GroupFlowNode } from './types';

function blurUnlessFocusWithin(event: React.FocusEvent<HTMLElement>, onBlur: () => void) {
  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
    onBlur();
  }
}

/** Node do React Flow para grupo documental — destino das conexões de acesso. */
export const GroupCardNode = memo(function GroupCardNode({ data }: NodeProps<GroupFlowNode>) {
  const {
    group,
    memberCount,
    selected,
    highlighted,
    dimmed,
    connectSource,
    isAdmin,
    connectedLinks,
    onSelect,
    onStartConnect,
    onDisconnectFromCategory,
    onOpenConnection,
    onMemberCountClick,
    onHoverStart,
    onHoverEnd,
  } = data;

  const styles = GROUP_COLOR_STYLES[group.color];
  const [menuOpen, setMenuOpen] = useState(false);
  const menuAnchorRef = useRef<HTMLButtonElement>(null);
  const hasConnections = connectedLinks.length > 0;

  const handleConnectionClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (hasConnections) {
      setMenuOpen((open) => !open);
      return;
    }
    onStartConnect?.();
  };

  return (
    <div
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onFocusCapture={onHoverStart}
      onBlurCapture={(event) => blurUnlessFocusWithin(event, onHoverEnd)}
      className="relative"
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isAdmin}
        className="governance-flow-handle governance-flow-handle--target"
        aria-label={`Conector de destino do grupo ${group.name}`}
      />
      <Card
        className={cn(
          'governance-flow-card w-full overflow-hidden border',
          selected && 'border-doqyn-border-strong ring-1 ring-doqyn-primary/20',
          highlighted && !selected && 'border-doqyn-border-strong',
          connectSource && 'border-doqyn-primary/50 ring-1 ring-doqyn-primary/15',
          dimmed && 'opacity-55 saturate-75',
        )}
      >
        <div className="flex items-start gap-2 p-3.5">
          <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-semibold',
                  styles.avatar,
                )}
              >
                {getInitials(group.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate text-sm font-semibold text-doqyn-text">{group.name}</p>
                  <span className="rounded-full border border-doqyn-border bg-doqyn-card px-1.5 py-0.5 text-[10px] font-medium text-doqyn-subtle">
                    Grupo
                  </span>
                  {isDocumentGroupId(group.id) && (
                    <span className="max-w-[9rem] truncate rounded-full bg-doqyn-surface px-1.5 py-0.5 font-mono text-[10px] text-doqyn-muted">
                      {group.id}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onMemberCountClick();
                  }}
                  className="nodrag text-left text-[11px] text-doqyn-muted hover:text-doqyn-text hover:underline"
                >
                  {memberCount} {memberCount === 1 ? 'membro' : 'membros'}
                </button>
                {group.description && (
                  <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-doqyn-subtle">
                    {group.description}
                  </p>
                )}
                {hasConnections ? (
                  <p className="mt-1.5 text-[11px] text-doqyn-subtle">
                    Acesso a {connectedLinks.length}{' '}
                    {connectedLinks.length === 1 ? 'categoria' : 'categorias'}
                  </p>
                ) : (
                  <p className="mt-1.5 text-[11px] text-doqyn-subtle">Sem categorias conectadas</p>
                )}
              </div>
            </div>
          </button>
          {isAdmin && (onStartConnect || hasConnections) && (
            <div className="relative shrink-0">
              <Button
                ref={menuAnchorRef}
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleConnectionClick}
                aria-label={
                  hasConnections
                    ? `Gerenciar conexões do grupo ${group.name}`
                    : `Conectar ${group.name} a uma categoria`
                }
                aria-expanded={menuOpen}
                className="nodrag h-8 w-8 px-0"
              >
                <Icon name="account_tree" size={ICON_SIZE.xs} />
              </Button>
              <AnchoredPopover
                anchorRef={menuAnchorRef}
                open={menuOpen && hasConnections}
                onClose={() => setMenuOpen(false)}
                placement="bottom-end"
                role="menu"
                aria-label={`Conexões do grupo ${group.name}`}
                zIndex="var(--z-context-menu)"
                className="min-w-[220px] py-1"
              >
                {connectedLinks.map((link) => (
                  <button
                    key={link.categoryId}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setMenuOpen(false);
                      onOpenConnection(link.categoryId);
                    }}
                    className="flex w-full flex-col gap-1 px-3 py-2 text-left hover:bg-doqyn-surface-hover"
                  >
                    <span className="text-[11px] font-medium text-doqyn-text">
                      {link.categoryName}
                    </span>
                    <GovernancePermissionBadges permissions={link.permissions} />
                  </button>
                ))}
                {onDisconnectFromCategory &&
                  connectedLinks.map((link) => (
                    <button
                      key={`unlink-${link.categoryId}`}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setMenuOpen(false);
                        onDisconnectFromCategory(link.categoryId);
                      }}
                      className="flex w-full items-center gap-2 border-t border-doqyn-border-subtle px-3 py-1.5 text-left text-[11px] text-doqyn-danger hover:bg-doqyn-danger-bg/30"
                    >
                      <Icon name="link_off" size={12} className="shrink-0" />
                      <span>Desconectar de {link.categoryName}</span>
                    </button>
                  ))}
                {onStartConnect && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setMenuOpen(false);
                      onStartConnect();
                    }}
                    className="flex w-full items-center gap-2 border-t border-doqyn-border-subtle px-3 py-1.5 text-left text-[11px] text-doqyn-primary hover:bg-doqyn-primary-bg/40"
                  >
                    <Icon name="account_tree" size={12} className="shrink-0" />
                    <span>Conectar outra categoria</span>
                  </button>
                )}
              </AnchoredPopover>
            </div>
          )}
        </div>
        <p className="border-t border-doqyn-border-subtle/80 px-3.5 py-2 text-center text-[10px] text-doqyn-subtle">
          Membros em{' '}
          <Link
            to="/users"
            className="nodrag text-doqyn-muted hover:text-doqyn-text hover:underline"
          >
            Usuários
          </Link>
        </p>
      </Card>
    </div>
  );
});
