import { BrandMark } from '@/components/brand/BrandMark';
import { cn } from '@/lib/utils';

type DoqynLogoSize = 'sm' | 'md' | 'lg' | 'sidebar';

type DoqynLogoProps = {
  size?: DoqynLogoSize;
  align?: 'left' | 'center';
  showSubtitle?: boolean;
  showMark?: boolean;
  subtitle?: string;
  className?: string;
};

const wordmarkSize: Record<DoqynLogoSize, string> = {
  sm: 'text-[15px]',
  md: 'text-[22px]',
  lg: 'text-[26px]',
  sidebar: 'text-[15px]',
};

const subtitleSize: Record<DoqynLogoSize, string> = {
  sm: 'mt-0.5 text-[9px] tracking-[0.16em]',
  md: 'mt-1 text-[10px] tracking-[0.18em]',
  lg: 'mt-1 text-[10px] tracking-[0.18em]',
  sidebar: 'mt-0.5 text-[9px] tracking-[0.14em]',
};

const markSize: Record<DoqynLogoSize, 'xs' | 'sm' | 'md' | 'lg'> = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  sidebar: 'sm',
};

export function DoqynLogo({
  size = 'md',
  align = 'left',
  showSubtitle = false,
  showMark = true,
  subtitle = 'Document Intelligence',
  className,
}: DoqynLogoProps) {
  const wordmark = (
    <span
      className={cn(
        'font-logo font-bold uppercase tracking-[-0.055em] text-doqyn-logo',
        wordmarkSize[size],
      )}
    >
      DOQYN
    </span>
  );

  const subtitleEl = showSubtitle ? (
    <span className={cn('font-medium uppercase text-doqyn-logo-muted', subtitleSize[size])}>
      {subtitle}
    </span>
  ) : null;

  return (
    <div
      className={cn(
        'flex select-none leading-none',
        align === 'center' ? 'flex-col items-center text-center' : 'items-center gap-2.5',
        className,
      )}
    >
      {align === 'center' ? (
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2">
            {showMark && <BrandMark size={markSize[size]} />}
            {wordmark}
          </div>
          {subtitleEl}
        </div>
      ) : (
        <>
          {showMark && <BrandMark size={markSize[size]} />}
          <div className="flex flex-col">
            {wordmark}
            {subtitleEl}
          </div>
        </>
      )}
    </div>
  );
}
