import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  LogOut,
  Scale,
  Settings,
  Shield,
  Upload,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { DoqynLogo } from '@/components/brand';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useAuth } from '@/features/auth/useAuth';
import { NAV_ITEMS_ADMIN, NAV_ITEMS_PRIMARY } from '@/lib/constants';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const ICON_MAP = {
  LayoutDashboard,
  Upload,
  Scale,
  Shield,
  Settings,
} as const;

interface SidebarProps {
  className?: string;
}

function NavItem({
  item,
}: {
  item: (typeof NAV_ITEMS_PRIMARY)[number] | (typeof NAV_ITEMS_ADMIN)[number];
}) {
  const Icon = ICON_MAP[item.icon];

  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        cn(
          'flex h-[34px] items-center gap-2 overflow-visible rounded-sm border-l-2 pl-[10px] pr-2.5 text-[13px] transition-colors duration-100',
          isActive
            ? 'border-l-doqyn-accent-active bg-doqyn-accent-active-bg font-medium text-doqyn-text'
            : 'border-l-transparent text-doqyn-muted hover:bg-doqyn-hover hover:text-doqyn-text',
        )
      }
    >
      <Icon className="h-[15px] w-[15px] shrink-0" strokeWidth={1.5} />
      <span className="whitespace-nowrap">{item.label}</span>
    </NavLink>
  );
}

export function Sidebar({ className }: SidebarProps) {
  const { user, logout } = useAuth();

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.health().catch(() => null),
    retry: false,
  });

  return (
    <aside
      className={cn(
        'flex h-screen w-[200px] min-w-[200px] shrink-0 flex-col overflow-y-auto border-r border-doqyn-border bg-doqyn-sidebar scrollbar-thin',
        className,
      )}
    >
      <div className="border-b border-doqyn-border px-4 py-4">
        <DoqynLogo size="sidebar" showSubtitle subtitle="Document Intelligence" />
      </div>

      <nav className="flex-1 p-2">
        <div className="space-y-0.5">
          {NAV_ITEMS_PRIMARY.map((item) => (
            <NavItem key={item.path} item={item} />
          ))}
        </div>

        <div className="my-3 h-px bg-doqyn-border-subtle" />

        <p className="px-3 pb-1.5 pt-1 text-[9px] font-medium uppercase tracking-[0.12em] text-doqyn-subtle">
          Administração
        </p>
        <div className="space-y-0.5">
          {NAV_ITEMS_ADMIN.map((item) => (
            <NavItem key={item.path} item={item} />
          ))}
        </div>
      </nav>

      <div className="border-t border-doqyn-border p-2">
        <div className="mb-2 flex items-center justify-between gap-2 px-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-doqyn-subtle">
            Tema
          </span>
          <ThemeToggle />
        </div>

        <div className="mb-2 px-2">
          <p className="truncate text-xs font-medium text-doqyn-text">{user?.name}</p>
          <p className="truncate text-[11px] text-doqyn-muted">{user?.email}</p>
          {user?.companyName && (
            <p className="mt-0.5 truncate text-[10px] text-doqyn-subtle">{user.companyName}</p>
          )}
        </div>

        {health && (
          <div className="mb-2 flex items-center gap-2 px-2 text-[11px] text-doqyn-subtle">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-doqyn-success" />
            <span className="truncate">Sistema operacional</span>
          </div>
        )}

        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-[13px] text-doqyn-muted transition-colors hover:bg-doqyn-hover hover:text-doqyn-text"
        >
          <LogOut className="h-[15px] w-[15px]" strokeWidth={1.5} />
          Sair
        </button>
      </div>
    </aside>
  );
}
