import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/auth/useAuth';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { AnchoredPopover } from '@/components/ui/popover/AnchoredPopover';
import {
  getPlatformRoleLabel,
  resolvePrimaryPlatformRole,
} from '@/features/users/platformRoleLabels';
import { cn } from '@/lib/utils';
import { ICON_SIZE } from '@/lib/iconDefaults';

/** Menu do usuário no canto superior direito — estilo workspace de arquivos. */
export function HeaderUserMenu() {
  const { user, roles, tenant, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const displayName = user?.name?.trim() || user?.email || 'Usuário';
  const orgLabel = tenant?.displayName || user?.companyName;
  const primaryRole = resolvePrimaryPlatformRole(roles);

  return (
    <div className="relative shrink-0" data-testid="header-user-menu">
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          // Canto de 4px em vez de pílula, e o cargo em monoespaçado: ele é
          // rótulo de registro, não segunda linha de nome. Antes as duas linhas
          // tinham o mesmo peso e o bloco competia com o conteúdo da página.
          'explorer-interactive flex items-center gap-2.5 rounded-[4px] py-1 pl-1 pr-2 sm:pr-2.5',
          'transition-colors hover:bg-doqyn-hover/60',
          open && 'bg-doqyn-hover/60',
        )}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Menu do usuário"
      >
        <UserAvatar name={displayName} email={user?.email} avatarUrl={user?.avatarUrl} size="md" />
        <span className="hidden min-w-0 text-left md:block">
          <span className="block max-w-[140px] truncate text-caption font-medium leading-tight text-doqyn-text lg:max-w-[160px]">
            {displayName}
          </span>
          {/* O cargo em monoespaçado, sem caixa alta nem entreletra larga: em
              "Administrador da empresa" isso estourava a largura e o rótulo
              saía cortado na borda. O mono sozinho já dá o caráter de registro,
              e separa o cargo do nome sem competir com ele. */}
          {(primaryRole || orgLabel) && (
            <span className="mt-0.5 block max-w-[150px] truncate font-mono text-[10px] leading-tight text-doqyn-subtle lg:max-w-[190px]">
              {primaryRole ? getPlatformRoleLabel(primaryRole) : orgLabel}
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
        <div className="border-b border-doqyn-border-subtle px-3.5 py-3">
          <div className="flex items-center gap-2.5">
            <UserAvatar
              name={displayName}
              email={user?.email}
              avatarUrl={user?.avatarUrl}
              size="md"
            />
            <div className="min-w-0">
              <p className="truncate text-label text-doqyn-text">{displayName}</p>
              {user?.email && <p className="truncate text-micro text-doqyn-muted">{user.email}</p>}
            </div>
          </div>
          {orgLabel && (
            <p className="mt-2 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-doqyn-subtle">
              {orgLabel}
            </p>
          )}
        </div>

        <Link
          to="/settings"
          role="menuitem"
          className="explorer-interactive relative flex w-full items-center gap-2.5 rounded-none px-3.5 py-2 text-left text-label font-normal text-doqyn-text before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-transparent hover:bg-doqyn-hover/50 hover:before:bg-doqyn-accent-active"
          onClick={() => setOpen(false)}
        >
          <Icon name="settings" size={ICON_SIZE.md} />
          Configurações da conta
        </Link>

        <div className="my-1 border-t border-doqyn-border-subtle" />

        <button
          type="button"
          role="menuitem"
          className="explorer-interactive relative flex w-full items-center gap-2.5 rounded-none px-3.5 py-2 text-left text-label font-normal text-doqyn-muted before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-transparent hover:bg-doqyn-hover/50 hover:text-doqyn-text hover:before:bg-doqyn-accent-active"
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
