import { cn } from '@/lib/utils';

type BrandMarkProps = {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
};

const sizeMap = {
  xs: 'h-1 w-1',
  sm: 'h-1.5 w-1.5',
  md: 'h-2 w-2',
  lg: 'h-2.5 w-2.5',
};

/** Marca mínima — ponto central, alinhado ao padrão DOQYN. */
export function BrandMark({ size = 'sm', className }: BrandMarkProps) {
  return (
    <span
      className={cn('inline-block shrink-0 rounded-full bg-doqyn-text', sizeMap[size], className)}
      aria-hidden
      role="presentation"
    />
  );
}
