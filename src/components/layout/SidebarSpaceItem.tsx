import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { getFolderAccentColor } from '@/features/library/utils/folderColors';
import { SidebarTooltip } from './SidebarTooltip';

type SidebarSpaceItemProps = {
  id: string;
  name: string;
  isActive: boolean;
  collapsed: boolean;
};

export function SidebarSpaceItem({ id, name, isActive, collapsed }: SidebarSpaceItemProps) {
  const dotColor = getFolderAccentColor(name) ?? 'var(--text-tertiary)';

  const link = (
    <Link
      to={`/biblioteca?space=${encodeURIComponent(id)}`}
      className={cn(
        'sidebar-nav-link explorer-interactive group flex h-10 items-center gap-3 rounded-full text-label',
        'focus-visible:shadow-[var(--sidebar-focus-ring)] focus-visible:outline-none',
        collapsed ? 'justify-center px-0' : 'px-3',
        isActive
          ? 'sidebar-nav-link--active'
          : 'text-doqyn-muted hover:bg-doqyn-sidebar-item-hover hover:text-doqyn-text',
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: dotColor }}
        aria-hidden
      />
      {!collapsed && <span className="truncate">{name}</span>}
    </Link>
  );

  return (
    <SidebarTooltip label={name} collapsed={collapsed}>
      {link}
    </SidebarTooltip>
  );
}
