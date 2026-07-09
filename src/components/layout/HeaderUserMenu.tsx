import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/auth/useAuth';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { AnchoredPopover } from '@/components/ui/popover/AnchoredPopover';
import { cn } from '@/lib/utils';
import { ICON_SIZE } from '@/lib/iconDefaults';

const ROLE_LABELS: Record<string, string> = {
  doqyn_admin: 'Admin DOQYN',
  company_admin: 'Admin da empresa',
  user: 'Usuário',
};

const ROLE_PRIORITY = ['doqyn_admin', 'company_admin', 'user'] as const;

function resolvePrimaryRole(roles: string[]): string | null {
  for (const role of ROLE_PRIORITY) {
    if (roles.includes(role)) return role;
  }
  return roles[0] ?? null;
}

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

/** Menu do usuário no canto superior direito — estilo workspace de arquivos. */
export function HeaderUserMenu() {
  const { user, roles, tenant, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const displayName = user?.name?.trim() || user?.email || 'Usuário';
  const orgLabel = tenant?.displayName || user?.companyName;
  const primaryRole = resolvePrimaryRole(roles);

  return (
    <div className="relative shrink-0" data-testid="header-user-menu">
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'explorer-interactive flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2 sm:pr-3',
          'hover:bg-doqyn-surface-hover',
          open && 'bg-doqyn-surface-hover',
        )}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Menu do usuário"
      >
        <UserAvatar
          name={displayName}
          email={user?.email}
          avatarUrl={user?.avatarUrl}
          size="md"
        />
        <span className="hidden min-w-0 text-left md:block">
          <span className="block max-w-[140px] truncate text-[13px] font-medium leading-tight text-doqyn-text lg:max-w-[180px]">
            {displayName}
          </span>
          {(primaryRole || orgLabel) && (
            <span className="block max-w-[140px] truncate text-[11px] leading-tight text-doqyn-muted lg:max-w-[180px]">
              {primaryRole ? roleLabel(primaryRole) : orgLabel}
            </span>
          )}
        </span>
      </button>

      <AnchoredPopover
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        placement="bottom-end"
        role="menu"
        aria-label="Conta"
        data-testid="header-user-menu-dropdown"
        className="w-56 max-w-[calc(100vw-1rem)] py-1"
      >
        <div className="border-b border-doqyn-border-subtle px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <UserAvatar
              name={displayName}
              email={user?.email}
              avatarUrl={user?.avatarUrl}
              size="md"
            />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-doqyn-text">{displayName}</p>
              {user?.email && (
                <p className="truncate text-[11px] text-doqyn-muted">{user.email}</p>
              )}
            </div>
          </div>
          {orgLabel && <p className="mt-1 truncate text-[11px] text-doqyn-subtle">{orgLabel}</p>}
        </div>

        <Link
          to="/settings"
          role="menuitem"
          className="explorer-interactive flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-doqyn-text hover:bg-doqyn-surface-hover"
          onClick={() => setOpen(false)}
        >
          <Icon name="settings" size={ICON_SIZE.md} />
          Configurações da conta
        </Link>

        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <span className="text-[13px] text-doqyn-text">Tema</span>
          <ThemeToggle />
        </div>

        <div className="my-1 border-t border-doqyn-border-subtle" />

        <button
          type="button"
          role="menuitem"
          className="explorer-interactive flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-doqyn-muted hover:bg-doqyn-surface-hover hover:text-doqyn-text"
          onClick={() => {
            setOpen(false);
            logout();
          }}
        >
          <Icon name="logout" size={ICON_SIZE.md} />
          Sair
        </button>
      </AnchoredPopover>
    </div>
  );
}
