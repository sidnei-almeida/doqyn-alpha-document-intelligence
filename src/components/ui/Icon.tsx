import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

export interface IconProps {
  name: string;
  filled?: boolean;
  size?: number;
  weight?: 300 | 400 | 500 | 600 | 700;
  className?: string;
  color?: string;
  style?: CSSProperties;
}

/** Ícone Material Symbols Rounded — único sistema de ícones do app. */
export function Icon({
  name,
  filled = false,
  size = 20,
  weight = 400,
  className,
  color,
  style,
}: IconProps) {
  return (
    <span
      className={cn('material-symbols-rounded', className)}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${size}`,
        color,
        lineHeight: 1,
        display: 'inline-flex',
        userSelect: 'none',
        ...style,
      }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
