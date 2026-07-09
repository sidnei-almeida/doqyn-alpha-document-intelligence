import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import { resolveFileTypeVisual } from './fileTypeUtils';

type FileTypeIconProps = {
  fileName?: string;
  isFolder?: boolean;
  className?: string;
  color?: string;
  filled?: boolean;
  size?: number;
};

/** Ícone Material Symbols por tipo de arquivo ou pasta. */
export function FileTypeIcon({
  fileName = '',
  isFolder = false,
  className,
  color,
  filled = false,
  size,
}: FileTypeIconProps) {
  const { icon, toneClass } = resolveFileTypeVisual(fileName, isFolder);
  const resolvedSize = size ?? (isFolder ? ICON_SIZE.md : ICON_SIZE.sm);
  return (
    <Icon
      name={icon}
      filled={isFolder || filled}
      size={resolvedSize}
      className={cn('shrink-0', !color && toneClass, className)}
      color={color}
    />
  );
}
