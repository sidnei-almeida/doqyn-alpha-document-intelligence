import { cn } from '@/lib/utils';
import { DoqynMark } from './DoqynMark';

type BrandMarkProps = {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
};

const sizeMap = {
  xs: 16,
  sm: 24,
  md: 32,
  lg: 40,
};

/** Ícone DOQYN (somente a marca SVG) — sidebar recolhida, avatares, etc. */
export function BrandMark({ size = 'sm', className }: BrandMarkProps) {
  return <DoqynMark size={sizeMap[size]} className={cn('shrink-0', className)} />;
}
