import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import type { DocumentIcon } from '@/types/rules';

const ICON_MAP: Record<DocumentIcon, string> = {
  'file-text': 'description',
  receipt: 'receipt',
  'file-invoice': 'table_chart',
  users: 'group',
  'chart-bar': 'bar_chart',
  'shield-check': 'verified_user',
  folder: 'folder',
};

type CategoryIconProps = {
  icon: DocumentIcon;
  className?: string;
  color?: string;
  filled?: boolean;
  size?: number;
};

export function CategoryIcon({
  icon,
  className,
  color,
  filled = false,
  size = ICON_SIZE.sm,
}: CategoryIconProps) {
  return (
    <Icon
      name={ICON_MAP[icon] ?? 'folder'}
      filled={filled}
      size={size}
      className={cn(className)}
      color={color}
    />
  );
}
