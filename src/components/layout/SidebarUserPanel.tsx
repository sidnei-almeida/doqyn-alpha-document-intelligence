import { useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { AnchoredPopover } from '@/components/ui/popover/AnchoredPopover';
import { getInitials } from '@/utils/rulesHelpers';
import { cn } from '@/lib/utils';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { SidebarTooltip } from './SidebarTooltip';
import {
  getPlatformRoleLabel,
  resolvePrimaryPlatformRole,
} from '@/features/users/platformRoleLabels';

type SidebarUserPanelProps = {
  name?: string;
  email?: string;
  roles: string[];
  tenantName?: string;
  companyName?: string;
  systemHealthy?: boolean;
  collapsed?: boolean;
  onLogout: () => void;
};

export function SidebarUserPanel({
  name,
  email,
  roles,
  tenantName,
  companyName,
  systemHealthy,
  collapsed = false,
  onLogout,
}: SidebarUserPanelProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const displayName = name?.trim() || email || 'Usuário';
  const initials = getInitials(displayName);
  const orgLabel = tenantName || companyName;
  const primaryRole = resolvePrimaryPlatformRole(roles);

  const profileButton = (
    <button
      ref={anchorRef}
      type="button"
      onClick={() => setPopoverOpen((open) => !open)}
      className={cn(
        'flex w-full items-center gap-3 rounded-full px-2 py-2 text-left transition-colors',
        'hover:bg-doqyn-surface-hover',
        collapsed && 'justify-center px-0',
      )}
      aria-expanded={popoverOpen}
      aria-haspopup="dialog"
      data-testid="sidebar-user-card"
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-doqyn-card text-micro font-medium text-doqyn-text"
        aria-hidden
      >
        {initials}
      </div>
      {!collapsed && (
        <div className="min-w-0 flex-1">
          <p className="truncate text-label text-doqyn-text">{displayName}</p>
          {primaryRole && (
            <Badge
              variant="neutral"
              dot={false}
              className="mt-1 max-w-full truncate font-medium normal-case tracking-normal"
            >
              {getPlatformRoleLabel(primaryRole)}
            </Badge>
          )}
        </div>
      )}
    </button>
  );

  return (
    <div className="relative shrink-0 border-t border-doqyn-border-subtle bg-doqyn-sidebar p-3">
      {!collapsed && (
        <div className="mb-2 flex items-center justify-between gap-2 px-2">
          <span className="text-micro font-medium text-doqyn-subtle">Tema</span>
          <ThemeToggle />
        </div>
      )}

      <SidebarTooltip label={displayName} collapsed={collapsed}>
        {profileButton}
      </SidebarTooltip>

      <AnchoredPopover
        anchorRef={anchorRef}
        open={popoverOpen}
        onClose={() => setPopoverOpen(false)}
        placement={collapsed ? 'right-start' : 'top-start'}
        aria-label="Detalhes da sessão"
        data-testid="sidebar-user-popover"
        className="w-64 p-3 shadow-modal"
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-doqyn-border bg-doqyn-card text-caption font-semibold text-doqyn-text"
            aria-hidden
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-label font-semibold text-doqyn-text">{displayName}</p>
            {email && <p className="caption-text truncate">{email}</p>}
            {orgLabel && <p className="meta-text mt-0.5 truncate">{orgLabel}</p>}
          </div>
        </div>

        {roles.length > 0 && (
          <div className="mt-3">
            <p className="text-eyebrow uppercase text-doqyn-subtle">Papéis</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {roles.map((role) => (
                <Badge
                  key={role}
                  variant={role === primaryRole ? 'default' : 'neutral'}
                  dot={false}
                  className="font-medium normal-case tracking-normal"
                >
                  {getPlatformRoleLabel(role)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {systemHealthy && (
          <div className="mt-3">
            <Badge variant="success" className="font-medium normal-case tracking-normal">
              Sistema operacional
            </Badge>
          </div>
        )}

        {collapsed && (
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-doqyn-border-subtle pt-3">
            <span className="text-micro text-doqyn-subtle">Tema</span>
            <ThemeToggle />
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setPopoverOpen(false);
            onLogout();
          }}
          className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-md border border-doqyn-border-subtle text-label text-doqyn-muted transition-colors hover:bg-doqyn-surface-hover hover:text-doqyn-text"
        >
          <Icon name="logout" size={ICON_SIZE.sm} />
          Sair
        </button>
      </AnchoredPopover>

      {!collapsed && (
        <button
          type="button"
          onClick={onLogout}
          className="mt-1 flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-label text-doqyn-muted transition-colors hover:bg-doqyn-surface-hover hover:text-doqyn-text"
        >
          <Icon name="logout" size={ICON_SIZE.sm} />
          Sair
        </button>
      )}
    </div>
  );
}
