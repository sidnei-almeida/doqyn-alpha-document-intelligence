import { Icon } from '@/components/ui/Icon';
import { Tooltip } from '@/components/ui/Tooltip';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';

type WorkspaceRefreshButtonProps = {
  onClick: () => void;
  label?: string;
  className?: string;
};

/** Botão de atualizar padronizado para headers de workspace. */
export function WorkspaceRefreshButton({
  onClick,
  label = 'Atualizar',
  className,
}: WorkspaceRefreshButtonProps) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        onClick={onClick}
        className={cn('workspace-action-btn explorer-icon-btn', className)}
        aria-label={label}
        data-testid="workspace-refresh-button"
      >
        <Icon name="refresh" size={ICON_SIZE.md} />
      </button>
    </Tooltip>
  );
}
